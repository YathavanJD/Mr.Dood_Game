'use strict';
/**
 * Mr.DooD QR Scan Hunt - game server (zero dependencies, Node 18+)
 *
 * Security model
 *  - Every QR code contains a SECRET, unguessable link  /s/<token>  (derived from SECRET with HMAC).
 *  - Letter images are NOT public files. They are only served to a player who really scanned that QR.
 *  - Players cannot edit, reset or list anything. All of that lives behind the admin login.
 *  - Admin = password login (ADMIN_PASSWORD) -> signed, HttpOnly cookie. Brute-force limited.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ------------------------------------------------------------------ config
const PORT = Number(process.env.PORT) || 3000;
const SECRET = process.env.SECRET || '';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const BASE_URL = (process.env.BASE_URL || '').replace(/\/+$/, '');
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const MIN_GAP_MS = (Number(process.env.MIN_SCAN_GAP_SEC) || 10) * 1000; // faster than this = flagged
const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL || '';
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || '';
const NTFY_TOPIC = process.env.NTFY_TOPIC || '';
const NTFY_SERVER = (process.env.NTFY_SERVER || 'https://ntfy.sh').replace(/\/+$/, '');
const TG_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const TG_CHAT = process.env.TELEGRAM_CHAT_ID || '';

if (SECRET.length < 16 || !ADMIN_PASSWORD) {
  console.error('\nMissing settings. Set these environment variables:\n  SECRET (at least 16 characters)\n  ADMIN_PASSWORD\n');
  process.exit(1);
}

const LETTERS = ['M', 'r', '.', 'D', 'o', 'o', 'D'];
const TOTAL = LETTERS.length;
const FINAL_WORD = 'mrdood';

const TOKENS = LETTERS.map((_, i) =>
  crypto.createHmac('sha256', SECRET).update('mrdood-letter-' + (i + 1)).digest('hex').slice(0, 20));
const TOKEN_MAP = new Map(TOKENS.map((t, i) => [t, i + 1]));

// ------------------------------------------------------------------ signing / cookies
const mac = (s) => crypto.createHmac('sha256', SECRET).update('ck|' + s).digest('base64url').slice(0, 32);
const sign = (v) => v + '.' + mac(v);
function unsign(s) {
  if (!s) return null;
  const i = s.lastIndexOf('.');
  if (i < 1) return null;
  const v = s.slice(0, i), m = s.slice(i + 1), e = mac(v);
  if (m.length !== e.length) return null;
  return crypto.timingSafeEqual(Buffer.from(m), Buffer.from(e)) ? v : null;
}
function parseCookies(req) {
  const out = {};
  (req.headers.cookie || '').split(';').forEach((p) => {
    const i = p.indexOf('=');
    if (i > 0) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
  });
  return out;
}
const isHttps = (req) => (req.headers['x-forwarded-proto'] || '').split(',')[0].trim() === 'https' || !!req.socket.encrypted;
function setCookie(req, res, name, value, opts = {}) {
  let c = `${name}=${encodeURIComponent(value)}; Path=${opts.path || '/'}; HttpOnly; SameSite=Strict; Max-Age=${opts.maxAge ?? 31536000}`;
  if (isHttps(req)) c += '; Secure';
  const prev = res.getHeader('Set-Cookie');
  res.setHeader('Set-Cookie', prev ? [].concat(prev, c) : c);
}

// ------------------------------------------------------------------ state + persistence
let state = { gameOpen: true, players: {}, log: [], resetAt: null };
let dirty = false, saving = false, saveTimer = null;

function scheduleSave(delay = 400) {
  dirty = true;
  if (saveTimer) return;
  saveTimer = setTimeout(() => { saveTimer = null; flush(); }, delay);
}
async function flush() {
  if (saving || !dirty) return;
  saving = true; dirty = false;
  let failed = false;
  try {
    const json = JSON.stringify(state);
    if (UPSTASH_URL && UPSTASH_TOKEN) {
      const r = await fetch(UPSTASH_URL, {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + UPSTASH_TOKEN, 'Content-Type': 'application/json' },
        body: JSON.stringify(['SET', 'mrdood:state', json]),
      });
      if (!r.ok) throw new Error('upstash ' + r.status);
    } else {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      const f = path.join(DATA_DIR, 'state.json');
      fs.writeFileSync(f + '.tmp', json);
      fs.renameSync(f + '.tmp', f);
    }
  } catch (e) {
    failed = true;
    console.error('save failed:', e.message);
  } finally {
    saving = false;
    if (failed) { dirty = true; }
    if (dirty && !saveTimer) scheduleSave(failed ? 3000 : 400);
  }
}
async function load() {
  try {
    let raw = null;
    if (UPSTASH_URL && UPSTASH_TOKEN) {
      const r = await fetch(UPSTASH_URL, {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + UPSTASH_TOKEN, 'Content-Type': 'application/json' },
        body: JSON.stringify(['GET', 'mrdood:state']),
      });
      const j = await r.json();
      raw = j.result || null;
    } else {
      const f = path.join(DATA_DIR, 'state.json');
      if (fs.existsSync(f)) raw = fs.readFileSync(f, 'utf8');
    }
    if (raw) {
      const s = JSON.parse(raw);
      state = Object.assign({ gameOpen: true, players: {}, log: [], resetAt: null }, s);
    }
  } catch (e) {
    console.error('load failed (starting fresh):', e.message);
  }
}

// ------------------------------------------------------------------ admin notifications
const sseClients = new Set();

async function pushExternal(ev) {
  if (ev.quiet) return;
  const title = ev.type === 'win' ? 'Mr.DooD WINNER' : ev.type === 'scan' ? 'Mr.DooD scan' : 'Mr.DooD';
  const tags = ev.type === 'win' ? 'trophy' : ev.flagged ? 'warning' : ev.type === 'scan' ? 'iphone' : 'wave';
  try {
    if (NTFY_TOPIC) {
      await fetch(`${NTFY_SERVER}/${encodeURIComponent(NTFY_TOPIC)}`, {
        method: 'POST',
        headers: { Title: title, Tags: tags, Priority: ev.type === 'win' ? '5' : '3' },
        body: ev.text,
      });
    }
    if (TG_TOKEN && TG_CHAT) {
      await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: TG_CHAT, text: ev.text }),
      });
    }
  } catch (e) { /* notifications must never break the game */ }
}
function emit(ev) {
  ev.at = Date.now();
  ev.id = crypto.randomBytes(4).toString('hex');
  state.log.push(ev);
  if (state.log.length > 300) state.log.splice(0, state.log.length - 300);
  scheduleSave();
  const data = `data: ${JSON.stringify(ev)}\n\n`;
  for (const c of sseClients) { try { c.write(data); } catch (e) { /* closed */ } }
  pushExternal(ev);
}
setInterval(() => { for (const c of sseClients) { try { c.write(': hb\n\n'); } catch (e) { /* closed */ } } }, 15000).unref();

// ------------------------------------------------------------------ rate limiting
const hits = new Map();
function limited(key, max, windowMs) {
  const now = Date.now();
  const a = (hits.get(key) || []).filter((t) => now - t < windowMs);
  if (a.length >= max) { hits.set(key, a); return true; }
  a.push(now); hits.set(key, a);
  return false;
}
setInterval(() => {
  const now = Date.now();
  for (const [k, a] of hits) if (!a.length || now - a[a.length - 1] > 3600000) hits.delete(k);
}, 600000).unref();
const clientIp = (req) => (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '?').split(',')[0].trim();

// ------------------------------------------------------------------ helpers
const SEC_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'X-Robots-Tag': 'noindex, nofollow',
  'Content-Security-Policy': "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
};
function send(res, status, body, headers = {}) {
  res.writeHead(status, { ...SEC_HEADERS, ...headers });
  res.end(body);
}
function json(res, status, obj) {
  send(res, status, JSON.stringify(obj), { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
}
function readJson(req) {
  return new Promise((resolve, reject) => {
    if (!/application\/json/i.test(req.headers['content-type'] || '')) return reject(Object.assign(new Error('type'), { code: 415 }));
    let size = 0; const chunks = [];
    req.on('data', (c) => { size += c.length; if (size > 8192) { reject(Object.assign(new Error('big'), { code: 413 })); req.destroy(); return; } chunks.push(c); });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch (e) { reject(Object.assign(new Error('json'), { code: 400 })); }
    });
    req.on('error', reject);
  });
}
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg' };
function sendFile(res, file, extra = {}) {
  fs.readFile(file, (err, buf) => {
    if (err) return send(res, 404, 'Not found', { 'Content-Type': 'text/plain' });
    send(res, 200, buf, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', ...extra });
  });
}
const NOT_FOUND_PAGE = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Mr.DooD</title><body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#ff6a00;color:#fff;font-family:system-ui,sans-serif;text-align:center;padding:24px"><div><h1 style="font-size:42px;margin:0 0 8px">Mr.DooD</h1><p style="font-size:18px">This QR code or link is not valid.<br>Find the real cards and scan them with your camera!</p><p><a href="/" style="color:#fff;font-weight:700">Open the game</a></p></div></body>`;

function cleanName(n) {
  return String(n || '').replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 24);
}
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function claimCode() {
  let s = '';
  const b = crypto.randomBytes(6);
  for (let i = 0; i < 6; i++) s += CODE_ALPHABET[b[i] % CODE_ALPHABET.length];
  return s;
}
const winnerCount = () => Object.values(state.players).filter((p) => p.won).length;

function getPlayer(req) {
  const id = unsign(parseCookies(req).pid);
  return (id && state.players[id]) || null;
}
function foundList(p) {
  return p.scans.map((s) => ({ n: s.n, letter: LETTERS[s.n - 1], at: s.at }));
}
function isAdmin(req) {
  const v = unsign(parseCookies(req).adm);
  if (!v || !v.startsWith('adm:')) return false;
  return Number(v.slice(4)) > Date.now();
}
function baseUrl(req) {
  if (BASE_URL) return BASE_URL;
  const proto = (req.headers['x-forwarded-proto'] || 'http').split(',')[0].trim();
  return `${proto}://${req.headers.host}`;
}

function adminState() {
  const players = Object.values(state.players).map((p) => ({
    id: p.id, name: p.name, createdAt: p.createdAt, count: p.scans.length,
    letters: p.scans.map((s) => LETTERS[s.n - 1]),
    nums: p.scans.map((s) => s.n),
    last: p.scans.length ? p.scans[p.scans.length - 1].at : null,
    flags: p.scans.filter((s) => s.flag).length,
    dq: !!p.dq, won: p.won || null,
  })).sort((a, b) => (b.last || b.createdAt) - (a.last || a.createdAt));
  const letterStats = LETTERS.map((letter, i) => {
    let scans = 0, first = null;
    for (const p of Object.values(state.players)) {
      const s = p.scans.find((x) => x.n === i + 1);
      if (s) { scans++; if (!first || s.at < first.at) first = { name: p.name, at: s.at }; }
    }
    return { n: i + 1, letter, scans, first };
  });
  const winners = players.filter((p) => p.won).sort((a, b) => a.won.rank - b.won.rank);
  return {
    gameOpen: state.gameOpen, total: TOTAL, players, letterStats, winners,
    log: state.log.slice(-120), persistence: UPSTASH_URL ? 'upstash' : 'file',
    push: { ntfy: !!NTFY_TOPIC, telegram: !!(TG_TOKEN && TG_CHAT) },
  };
}

// ------------------------------------------------------------------ request handler
async function handle(req, res) {
  const url = new URL(req.url, 'http://x');
  const p = url.pathname;
  const m = req.method;

  if (p === '/healthz') return send(res, 200, 'ok', { 'Content-Type': 'text/plain' });
  if (p === '/robots.txt') return send(res, 200, 'User-agent: *\nDisallow: /\n', { 'Content-Type': 'text/plain' });
  if (p === '/favicon.ico') return send(res, 204, '');

  // ---------- pages
  if (m === 'GET' && (p === '/' || /^\/s\/[A-Za-z0-9]{1,64}\/?$/.test(p))) {
    return sendFile(res, path.join(__dirname, 'public', 'index.html'), { 'Cache-Control': 'no-store' });
  }
  if (m === 'GET' && (p === '/admin' || p === '/admin/')) {
    return sendFile(res, path.join(__dirname, 'public', 'admin.html'), { 'Cache-Control': 'no-store' });
  }
  if (m === 'GET' && /^\/assets\/[a-z0-9._-]+$/i.test(p)) {
    return sendFile(res, path.join(__dirname, 'public', 'assets', path.basename(p)), { 'Cache-Control': 'no-cache' });
  }

  // ---------- player API
  if (p === '/api/register' && m === 'POST') {
    const ip = clientIp(req);
    if (limited('reg:' + ip, 80, 600000)) return json(res, 429, { error: 'slow_down' });
    const body = await readJson(req);
    const existing = getPlayer(req);
    if (existing) return json(res, 200, { ok: true, name: existing.name });
    const name = cleanName(body.name);
    if (name.length < 2) return json(res, 400, { error: 'name_short' });
    const lower = name.toLowerCase();
    if (Object.values(state.players).some((q) => q.name.toLowerCase() === lower)) return json(res, 409, { error: 'name_taken' });
    const id = crypto.randomBytes(12).toString('hex');
    state.players[id] = { id, name, createdAt: Date.now(), scans: [], won: null, dq: false, attempts: 0 };
    setCookie(req, res, 'pid', sign(id));
    scheduleSave();
    emit({ type: 'register', name, text: `${name} joined the hunt` });
    return json(res, 200, { ok: true, name });
  }

  if (p === '/api/me' && m === 'GET') {
    const pl = getPlayer(req);
    if (!pl) return json(res, 401, { error: 'register' });
    return json(res, 200, {
      name: pl.name, found: foundList(pl), count: pl.scans.length, total: TOTAL,
      gameOpen: state.gameOpen, dq: !!pl.dq,
      won: pl.won ? { rank: pl.won.rank, code: pl.won.code, ms: pl.won.ms, at: pl.won.at } : null,
      startedAt: pl.scans.length ? pl.scans[0].at : null,
    });
  }

  if (p === '/api/leaderboard' && m === 'GET') {
    const all = Object.values(state.players).filter((q) => !q.dq);
    const winners = all.filter((q) => q.won).sort((a, b) => a.won.rank - b.won.rank).slice(0, 10)
      .map((q) => ({ rank: q.won.rank, name: q.name, ms: q.won.ms }));
    const hunters = all.filter((q) => !q.won && q.scans.length).sort((a, b) => b.scans.length - a.scans.length || a.scans[a.scans.length - 1].at - b.scans[b.scans.length - 1].at)
      .slice(0, 10).map((q) => ({ name: q.name, count: q.scans.length }));
    return json(res, 200, { winners, hunters, players: all.length });
  }

  if (p === '/api/scan' && m === 'POST') {
    const body = await readJson(req);
    const ip = clientIp(req);
    if (limited('scan:' + ip, 300, 60000)) return json(res, 429, { error: 'slow_down' });
    const token = String(body.token || '');
    const n = TOKEN_MAP.get(token);
    if (!n) {
      if (limited('bad:' + ip, 30, 600000)) return json(res, 429, { error: 'slow_down' });
      return json(res, 404, { error: 'invalid' });
    }
    const pl = getPlayer(req);
    if (!pl) return json(res, 401, { error: 'register' });
    if (pl.dq) return json(res, 403, { error: 'dq' });
    if (!state.gameOpen) return json(res, 403, { error: 'closed' });
    const already = pl.scans.find((s) => s.n === n);
    if (already) {
      emit({ type: 'scan', dup: true, quiet: true, name: pl.name, n, letter: LETTERS[n - 1], count: pl.scans.length, text: `${pl.name} re-scanned QR #${n} (${LETTERS[n - 1]})` });
      return json(res, 200, { ok: true, duplicate: true, n, letter: LETTERS[n - 1], count: pl.scans.length, total: TOTAL, won: !!pl.won });
    }
    const now = Date.now();
    const prev = pl.scans.length ? pl.scans[pl.scans.length - 1].at : null;
    const flag = prev !== null && now - prev < MIN_GAP_MS;
    pl.scans.push({ n, at: now, flag });
    scheduleSave();
    const count = pl.scans.length;
    let text = `${pl.name} scanned QR #${n} (letter "${LETTERS[n - 1]}") - ${count}/${TOTAL} collected`;
    if (flag) text += ` - WARNING: only ${Math.round((now - prev) / 1000)}s after the previous scan`;
    emit({ type: 'scan', name: pl.name, n, letter: LETTERS[n - 1], count, flagged: flag, text });
    return json(res, 200, { ok: true, duplicate: false, n, letter: LETTERS[n - 1], count, total: TOTAL, won: !!pl.won });
  }

  const img = p.match(/^\/api\/letter\/([1-7])\.jpg$/);
  if (img && m === 'GET') {
    const pl = getPlayer(req);
    const n = Number(img[1]);
    if (!pl || pl.dq || !pl.scans.some((s) => s.n === n)) return send(res, 403, 'Scan the QR first', { 'Content-Type': 'text/plain' });
    return sendFile(res, path.join(__dirname, 'private', 'img', n + '.jpg'), { 'Cache-Control': 'private, max-age=3600' });
  }

  if (p === '/api/submit' && m === 'POST') {
    const body = await readJson(req);
    const pl = getPlayer(req);
    if (!pl) return json(res, 401, { error: 'register' });
    if (pl.dq) return json(res, 403, { error: 'dq' });
    if (!state.gameOpen) return json(res, 403, { error: 'closed' });
    if (pl.won) return json(res, 200, { ok: true, rank: pl.won.rank, code: pl.won.code });
    if (pl.scans.length < TOTAL) return json(res, 400, { error: 'not_enough' });
    if (limited('sub:' + pl.id, 8, 60000)) return json(res, 429, { error: 'slow_down' });
    const answer = String(body.answer || '').toLowerCase().replace(/[^a-z]/g, '');
    if (answer !== FINAL_WORD) {
      pl.attempts = (pl.attempts || 0) + 1; scheduleSave();
      return json(res, 200, { ok: false });
    }
    const at = Date.now();
    pl.won = { rank: winnerCount() + 1, at, ms: at - pl.scans[0].at, code: claimCode() };
    scheduleSave();
    emit({ type: 'win', name: pl.name, rank: pl.won.rank, code: pl.won.code, text: `WINNER #${pl.won.rank}: ${pl.name} finished the hunt! Claim code ${pl.won.code}` });
    return json(res, 200, { ok: true, rank: pl.won.rank, code: pl.won.code });
  }

  // ---------- admin API
  if (p === '/admin/api/login' && m === 'POST') {
    const ip = clientIp(req);
    if (limited('login:' + ip, 8, 900000)) return json(res, 429, { error: 'too_many' });
    const body = await readJson(req);
    const a = crypto.createHash('sha256').update(String(body.password || '')).digest();
    const b = crypto.createHash('sha256').update(ADMIN_PASSWORD).digest();
    if (!crypto.timingSafeEqual(a, b)) return json(res, 401, { error: 'bad_password' });
    const maxAge = 12 * 3600;
    setCookie(req, res, 'adm', sign('adm:' + (Date.now() + maxAge * 1000)), { path: '/admin', maxAge });
    return json(res, 200, { ok: true });
  }
  if (p === '/admin/api/logout' && m === 'POST') {
    setCookie(req, res, 'adm', '', { path: '/admin', maxAge: 0 });
    return json(res, 200, { ok: true });
  }
  if (p.startsWith('/admin/api/')) {
    if (!isAdmin(req)) return json(res, 401, { error: 'auth' });

    if (p === '/admin/api/state' && m === 'GET') return json(res, 200, adminState());

    if (p === '/admin/api/stream' && m === 'GET') {
      res.writeHead(200, { ...SEC_HEADERS, 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
      res.write('retry: 3000\n: connected\n\n');
      sseClients.add(res);
      req.on('close', () => sseClients.delete(res));
      return;
    }

    if (p === '/admin/api/links' && m === 'GET') {
      const base = baseUrl(req);
      return json(res, 200, { base, links: LETTERS.map((letter, i) => ({ n: i + 1, letter, url: `${base}/s/${TOKENS[i]}` })) });
    }

    if (p === '/admin/api/game' && m === 'POST') {
      const body = await readJson(req);
      state.gameOpen = !!body.open; scheduleSave();
      emit({ type: 'admin', quiet: true, text: state.gameOpen ? 'Hunt RESUMED' : 'Hunt PAUSED (scans are blocked)' });
      return json(res, 200, { ok: true, gameOpen: state.gameOpen });
    }

    if (p === '/admin/api/reset' && m === 'POST') {
      const body = await readJson(req);
      if (body.confirm !== 'RESET') return json(res, 400, { error: 'confirm' });
      state.players = {}; state.log = []; state.resetAt = Date.now(); scheduleSave();
      emit({ type: 'admin', quiet: true, text: 'Game was RESET - all players and scores cleared' });
      return json(res, 200, { ok: true });
    }

    const act = p.match(/^\/admin\/api\/player\/([a-f0-9]{24})\/(disqualify|delete)$/);
    if (act && m === 'POST') {
      const pl = state.players[act[1]];
      if (!pl) return json(res, 404, { error: 'none' });
      const body = await readJson(req);
      if (act[2] === 'delete') {
        delete state.players[pl.id];
        emit({ type: 'admin', quiet: true, text: `Player ${pl.name} was removed` });
      } else {
        pl.dq = body.value !== false;
        emit({ type: 'admin', quiet: true, text: `${pl.name} was ${pl.dq ? 'DISQUALIFIED' : 'reinstated'}` });
      }
      scheduleSave();
      return json(res, 200, { ok: true });
    }
    return json(res, 404, { error: 'none' });
  }

  return send(res, 404, NOT_FOUND_PAGE, { 'Content-Type': 'text/html; charset=utf-8' });
}

const server = http.createServer((req, res) => {
  handle(req, res).catch((e) => {
    if (res.headersSent) return res.end();
    const code = e && e.code && Number.isInteger(e.code) ? e.code : 500;
    if (code === 500) console.error(e);
    json(res, code, { error: code === 500 ? 'server' : 'bad_request' });
  });
});
server.keepAliveTimeout = 65000;

load().then(() => {
  server.listen(PORT, () => console.log(`Mr.DooD hunt running on :${PORT} (${UPSTASH_URL ? 'upstash' : 'file'} storage)`));
});
async function shutdown() { dirty = true; await flush(); process.exit(0); }
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

(() => {
  'use strict';
  const app = document.getElementById('app');
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const show = (html) => { app.innerHTML = html; window.scrollTo(0, 0); };
  const logo = '<div class="logo">Mr.DooD</div>';
  let lbTimer = null;

  async function api(url, body) {
    const opt = body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
    try {
      const r = await fetch(url, opt);
      let j = {};
      try { j = await r.json(); } catch (e) { /* no body */ }
      return Object.assign({}, j, { status: r.status });
    } catch (e) {
      return { status: 0, error: 'network' };
    }
  }
  const fmtTime = (ms) => {
    const s = Math.round(ms / 1000), m = Math.floor(s / 60);
    return m ? `${m}m ${s % 60}s` : `${s}s`;
  };

  function message(icon, title, text, withHome = true) {
    show(`${logo}<div class="card center"><div class="trophy">${icon}</div><h2>${esc(title)}</h2><p>${text}</p>${withHome ? '<button id="home">Back to the game</button>' : ''}</div>`);
    const b = document.getElementById('home');
    if (b) b.onclick = home;
  }

  // ---------------------------------------------------------------- welcome / register
  function welcome(opts = {}) {
    const fromScan = !!opts.token;
    show(`${logo}
      <div class="card">
        <h2>${fromScan ? 'One quick thing!' : 'Welcome, hunter!'}</h2>
        <p>${fromScan ? 'Enter your name so your scan counts and the host knows who found it.' : 'Find the <b>7 hidden QR codes</b>, collect every letter and work out the secret word.'}</p>
        ${fromScan ? '' : `<ol class="rules">
          <li>Search the venue for QR cards.</li>
          <li>Scan each one with your phone camera.</li>
          <li>Every card reveals one letter.</li>
          <li>Collect all 7, then type the secret word.</li>
          <li>First to finish wins!</li></ol>`}
        <input id="name" type="text" maxlength="24" placeholder="Your name" autocomplete="nickname" autocapitalize="words">
        <div class="err" id="err"></div>
        <button id="go">${fromScan ? 'Save my name & reveal' : 'Start the hunt'}</button>
      </div>`);
    const input = document.getElementById('name'), err = document.getElementById('err'), btn = document.getElementById('go');
    const submit = async () => {
      const name = input.value.trim();
      if (name.length < 2) { err.textContent = 'Please enter at least 2 characters.'; return; }
      btn.disabled = true; err.textContent = '';
      const r = await api('/api/register', { name });
      if (r.status === 409) { err.textContent = 'That name is already taken - add something to it.'; btn.disabled = false; return; }
      if (!r.ok) { err.textContent = 'Something went wrong. Try again.'; btn.disabled = false; return; }
      if (opts.token) { const s = await api('/api/scan', { token: opts.token }); return afterScan(s); }
      home();
    };
    btn.onclick = submit;
    input.onkeydown = (e) => { if (e.key === 'Enter') submit(); };
    setTimeout(() => input.focus(), 150);
  }

  // ---------------------------------------------------------------- scan flow
  async function handleScan(token) {
    show('<div class="card center"><div class="spinner"></div><p>Checking the QR code...</p></div>');
    const r = await api('/api/scan', { token });
    if (r.status === 401) return welcome({ token });
    afterScan(r, token);
  }
  function afterScan(r, token) {
    if (r.status === 0) return message('📡', 'No connection', 'Check your internet and scan the QR again.', false);
    if (r.status === 404) return message('🤔', 'Not a game QR', 'That code is not part of the hunt. Look for the real cards!');
    if (r.status === 429) return message('⏳', 'Slow down', 'Too many tries. Wait a moment and scan again.');
    if (r.status === 403 && r.error === 'closed') return message('⏸️', 'Hunt is paused', 'The host has paused the game. Hang tight!');
    if (r.status === 403) return message('🚫', 'Not allowed', 'You have been removed from this hunt. Talk to the host.', false);
    if (r.status === 401) return welcome({ token });
    if (!r.ok) return message('⚠️', 'Oops', 'Something went wrong. Try scanning again.');
    reveal(r);
  }
  function reveal(r) {
    const left = r.total - r.count;
    show(`${logo}
      <div class="card center">
        <span class="tag">${r.duplicate ? 'Already collected' : 'New letter found!'}</span>
        <img class="revimg" id="rimg" alt="Letter ${esc(r.letter)}" src="/api/letter/${r.n}.jpg">
        <h2>${r.count} of ${r.total} letters</h2>
        <p>${left > 0 ? `${left} more to find. Keep hunting!` : '<b>You found them all!</b> Now solve the secret word.'}</p>
        <button id="go">${left > 0 ? 'Continue the hunt' : 'Solve the secret word'}</button>
      </div>`);
    const img = document.getElementById('rimg');
    const fin = () => img.classList.add('in');
    if (img.complete) fin(); else { img.onload = fin; img.onerror = fin; }
    document.getElementById('go').onclick = home;
    if (r.count === r.total && !r.duplicate) confetti(2500);
  }

  // ---------------------------------------------------------------- main hunt screen
  async function home() {
    clearInterval(lbTimer);
    show('<div class="card center"><div class="spinner"></div></div>');
    const me = await api('/api/me');
    if (me.status === 401) return welcome();
    if (me.status !== 200) return message('📡', 'No connection', 'Check your internet and try again.', false);
    if (me.dq) return message('🚫', 'Removed from the hunt', 'Please talk to the host.', false);
    if (me.won) return winScreen(me);
    hunt(me);
  }

  function tilesHtml(me) {
    let t = '';
    for (let i = 0; i < me.total; i++) {
      const f = me.found[i];
      t += f ? `<div class="tile on">${esc(f.letter)}</div>` : '<div class="tile">?</div>';
    }
    return t;
  }

  function hunt(me) {
    const all = me.count >= me.total;
    show(`${logo}
      ${me.gameOpen ? '' : '<div class="banner">⏸️ The host has paused the hunt. Scans are on hold.</div>'}
      <div class="card">
        <h3>Hunter</h3><h2>${esc(me.name)}</h2>
        <div class="tiles">${tilesHtml(me)}</div>
        <div class="bar"><i style="width:${Math.round(me.count / me.total * 100)}%"></i></div>
        <p class="muted center">${me.count} / ${me.total} letters collected</p>
        ${all ? `
          <h3 style="margin-top:18px">Final step</h3>
          <p>You have every letter! The letters are in the order you found them, so unscramble them and type the <b>secret word</b>.</p>
          <input id="ans" type="text" maxlength="20" placeholder="Secret word" autocomplete="off" autocapitalize="off">
          <div class="err" id="err"></div>
          <button id="sub">Claim victory</button>`
          : `<p class="center">Find the QR cards around the venue and scan them with your <b>phone camera</b> to reveal letters.</p>`}
      </div>
      <div class="card"><h3>Leaderboard</h3><div id="lb" class="muted">Loading...</div></div>`);
    if (all) {
      const ans = document.getElementById('ans'), err = document.getElementById('err'), btn = document.getElementById('sub');
      const submit = async () => {
        if (!ans.value.trim()) return;
        btn.disabled = true; err.textContent = '';
        const r = await api('/api/submit', { answer: ans.value });
        if (r.ok) { confetti(5000); return home(); }
        if (r.status === 429) err.textContent = 'Too many tries - wait a few seconds.';
        else if (r.status === 403) err.textContent = 'The hunt is paused right now.';
        else err.textContent = 'Not quite! Think about the letters again.';
        btn.disabled = false;
      };
      btn.onclick = submit;
      ans.onkeydown = (e) => { if (e.key === 'Enter') submit(); };
    }
    loadLb(); lbTimer = setInterval(loadLb, 15000);
  }

  function winScreen(me) {
    show(`${logo}
      <div class="card center">
        <div class="trophy">🏆</div>
        <h2>You finished #${me.won.rank}!</h2>
        <p><b>${esc(me.name)}</b>, you cracked the secret word in <b>${fmtTime(me.won.ms)}</b>.</p>
        <p class="muted">Show this screen to the host to claim your prize:</p>
        <div class="code">${esc(me.won.code)}</div>
      </div>
      <div class="card"><h3>Leaderboard</h3><div id="lb" class="muted">Loading...</div></div>`);
    confetti(3500);
    loadLb(); lbTimer = setInterval(loadLb, 15000);
  }

  async function loadLb() {
    const el = document.getElementById('lb');
    if (!el) { clearInterval(lbTimer); return; }
    const r = await api('/api/leaderboard');
    if (r.status !== 200) return;
    let h = '';
    if (r.winners.length) {
      h += '<ul class="lb">' + r.winners.map((w) => `<li><span>${w.rank === 1 ? '🥇' : w.rank === 2 ? '🥈' : w.rank === 3 ? '🥉' : '#' + w.rank} ${esc(w.name)}</span><b>${fmtTime(w.ms)}</b></li>`).join('') + '</ul>';
    }
    if (r.hunters.length) {
      h += `<p class="muted" style="margin-top:12px">Still hunting</p><ul class="lb">` + r.hunters.map((w) => `<li><span>${esc(w.name)}</span><b>${w.count}/7</b></li>`).join('') + '</ul>';
    }
    el.innerHTML = h || 'Nobody has scored yet. Be the first!';
  }

  // ---------------------------------------------------------------- confetti
  function confetti(ms) {
    const c = document.getElementById('confetti'), ctx = c.getContext('2d');
    c.width = innerWidth; c.height = innerHeight;
    const cols = ['#ff6a00', '#ff9e28', '#ffffff', '#ffd36b', '#c43e00'];
    const ps = Array.from({ length: 140 }, () => ({
      x: Math.random() * c.width, y: -20 - Math.random() * c.height * 0.5, r: 4 + Math.random() * 6,
      vy: 2 + Math.random() * 4, vx: -2 + Math.random() * 4, a: Math.random() * 6, col: cols[(Math.random() * cols.length) | 0],
    }));
    const end = Date.now() + ms;
    (function frame() {
      ctx.clearRect(0, 0, c.width, c.height);
      ps.forEach((p) => {
        p.x += p.vx; p.y += p.vy; p.a += 0.1;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a); ctx.fillStyle = p.col; ctx.fillRect(-p.r, -p.r / 2, p.r * 2, p.r); ctx.restore();
      });
      if (Date.now() < end) requestAnimationFrame(frame); else ctx.clearRect(0, 0, c.width, c.height);
    })();
  }

  // ---------------------------------------------------------------- start
  const m = location.pathname.match(/^\/s\/([A-Za-z0-9]+)\/?$/);
  if (m) { history.replaceState(null, '', '/'); handleScan(m[1]); } else home();
})();

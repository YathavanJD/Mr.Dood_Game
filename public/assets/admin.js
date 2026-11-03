(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const tm = (t) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const dur = (ms) => { const s = Math.round(ms / 1000), m = Math.floor(s / 60); return m ? `${m}m ${s % 60}s` : `${s}s`; };

  let S = null, es = null, soundOn = true, unread = 0, refreshT = null, audio = null;
  const baseTitle = 'Mr.DooD Admin';

  async function api(url, body) {
    const opt = body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
    try {
      const r = await fetch(url, opt);
      let j = {}; try { j = await r.json(); } catch (e) { /* none */ }
      return Object.assign({}, j, { status: r.status });
    } catch (e) { return { status: 0 }; }
  }

  // ------------------------------------------------------------ login
  function showLogin() { $('dash').classList.add('hidden'); $('login').classList.remove('hidden'); $('pw').focus(); }
  async function doLogin() {
    ensureAudio();
    $('lerr').textContent = '';
    const r = await api('/admin/api/login', { password: $('pw').value });
    if (r.status === 429) { $('lerr').textContent = 'Too many tries. Wait 15 minutes.'; return; }
    if (!r.ok) { $('lerr').textContent = 'Wrong password.'; return; }
    $('pw').value = '';
    start();
  }
  $('lbtn').onclick = doLogin;
  $('pw').onkeydown = (e) => { if (e.key === 'Enter') doLogin(); };

  async function start() {
    const r = await api('/admin/api/state');
    if (r.status === 401) return showLogin();
    $('login').classList.add('hidden'); $('dash').classList.remove('hidden');
    S = r; render(); renderFeed(S.log);
    connect();
  }

  // ------------------------------------------------------------ live stream
  function connect() {
    if (es) es.close();
    es = new EventSource('/admin/api/stream');
    es.onopen = () => { $('dot').className = 'dot'; $('conn').textContent = ' live'; };
    es.onerror = () => { $('dot').className = 'dot off'; $('conn').textContent = ' reconnecting...'; };
    es.onmessage = (e) => { try { onEvent(JSON.parse(e.data)); } catch (err) { /* ignore */ } };
  }
  function onEvent(ev) {
    addFeed(ev, true);
    if (ev.type === 'scan' && !ev.dup) { toast(ev.text, ev.flagged ? 'flag' : ''); beep(ev.flagged ? 'flag' : 'scan'); sysNotify('New scan', ev.text); }
    else if (ev.type === 'win') { toast('🏆 ' + ev.text, 'win'); beep('win'); sysNotify('We have a winner!', ev.text); }
    else if (ev.type === 'register') { toast(ev.text, ''); beep('reg'); }
    if (document.hidden) { unread++; document.title = `(${unread}) ${baseTitle}`; }
    clearTimeout(refreshT); refreshT = setTimeout(refresh, 350);
  }
  async function refresh() {
    const r = await api('/admin/api/state');
    if (r.status === 401) return showLogin();
    if (r.status === 200) { S = r; render(); }
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { unread = 0; document.title = baseTitle; } });

  // ------------------------------------------------------------ sound / notifications
  function ensureAudio() {
    try { if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)(); if (audio.state === 'suspended') audio.resume(); } catch (e) { /* none */ }
  }
  function tone(f, t0, d, vol = 0.18) {
    if (!audio) return;
    const o = audio.createOscillator(), g = audio.createGain();
    o.type = 'sine'; o.frequency.value = f; g.gain.value = vol;
    g.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + t0 + d);
    o.connect(g); g.connect(audio.destination); o.start(audio.currentTime + t0); o.stop(audio.currentTime + t0 + d);
  }
  function beep(kind) {
    if (!soundOn) return; ensureAudio();
    if (kind === 'scan') { tone(880, 0, 0.15); tone(1175, 0.15, 0.2); }
    else if (kind === 'win') { [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.14, 0.3, 0.22)); }
    else if (kind === 'flag') { tone(300, 0, 0.2, 0.25); tone(300, 0.28, 0.2, 0.25); }
    else tone(660, 0, 0.1, 0.1);
  }
  function sysNotify(title, body) {
    if (!('Notification' in window) || Notification.permission !== 'granted' || !document.hidden) return;
    try { new Notification(title, { body, tag: 'mrdood' }); } catch (e) { /* mobile browsers may block */ }
  }
  function toast(text, cls) {
    const d = document.createElement('div'); d.className = 'toast ' + (cls || ''); d.textContent = text;
    $('toasts').appendChild(d); setTimeout(() => d.remove(), 6500);
    while ($('toasts').children.length > 4) $('toasts').firstChild.remove();
  }

  // ------------------------------------------------------------ rendering
  function feedRow(ev) {
    const li = document.createElement('li');
    li.className = ev.flagged ? 'flag' : ev.dup ? 'dup' : ev.type;
    const t = document.createElement('span'); t.className = 't'; t.textContent = tm(ev.at);
    const x = document.createElement('span');
    x.textContent = (ev.type === 'win' ? '🏆 ' : ev.type === 'scan' && !ev.dup ? '📱 ' : ev.type === 'register' ? '👋 ' : '') + ev.text;
    li.append(t, x); return li;
  }
  function renderFeed(log) {
    const ul = $('feed'); ul.innerHTML = '';
    log.slice().reverse().forEach((ev) => ul.appendChild(feedRow(ev)));
    if (!log.length) ul.innerHTML = '<li class="muted">Waiting for the first scan...</li>';
  }
  function addFeed(ev) {
    const ul = $('feed'); if (ul.firstChild && ul.firstChild.classList.contains('muted')) ul.innerHTML = '';
    ul.insertBefore(feedRow(ev), ul.firstChild);
  }
  function render() {
    const scans = S.players.reduce((a, p) => a + p.count, 0);
    $('stats').innerHTML = [
      [S.players.length, 'players'], [scans, 'letters found'], [S.winners.length, 'winners'],
      [S.players.filter((p) => p.flags).length, 'flagged'],
    ].map(([n, l]) => `<div class="stat"><b>${n}</b><span>${l}</span></div>`).join('');
    $('bGame').textContent = S.gameOpen ? '⏸ Pause hunt' : '▶ Resume hunt';
    const push = [];
    push.push('Live alerts: <b>on</b> (keep this page open).');
    push.push(S.push.ntfy ? 'Phone push (ntfy): <b>on</b>.' : 'Phone push (ntfy): off.');
    push.push(S.push.telegram ? 'Telegram: <b>on</b>.' : 'Telegram: off.');
    push.push(S.persistence === 'upstash' ? 'Saved to Upstash (survives restarts).' : 'Saved to server disk (resets if Render restarts).');
    $('push').innerHTML = push.join(' ');

    $('qrs').innerHTML = '<tr><th>QR</th><th>Letter</th><th>Found by</th><th>First finder</th></tr>' +
      S.letterStats.map((l) => `<tr><td>#${l.n}</td><td><b>${esc(l.letter)}</b></td><td>${l.scans} players</td><td>${l.first ? esc(l.first.name) + ' @ ' + tm(l.first.at) : '-'}</td></tr>`).join('');

    $('wins').innerHTML = S.winners.length
      ? '<tr><th>Place</th><th>Name</th><th>Time</th><th>Claim code</th></tr>' + S.winners.map((p) => `<tr><td>#${p.won.rank}</td><td>${esc(p.name)}${p.dq ? ' <span class="pill r">DQ</span>' : ''}</td><td>${dur(p.won.ms)}</td><td><b>${esc(p.won.code)}</b></td></tr>`).join('')
      : '<tr><td class="muted">No winners yet.</td></tr>';

    $('players').innerHTML = S.players.length
      ? '<tr><th>Name</th><th>Letters</th><th>Last scan</th><th>Status</th><th></th></tr>' + S.players.map((p) => {
        const st = p.dq ? '<span class="pill r">disqualified</span>' : p.won ? '<span class="pill g">winner</span>' : p.flags ? `<span class="pill r">${p.flags} fast scan${p.flags > 1 ? 's' : ''}</span>` : '<span class="pill">hunting</span>';
        return `<tr><td>${esc(p.name)}</td><td>${p.count}/${S.total} <span class="muted">${esc(p.letters.join(' '))}</span></td><td>${p.last ? tm(p.last) : '-'}</td><td>${st}</td>
          <td><button class="xs" data-act="dq" data-id="${p.id}" data-v="${p.dq ? 0 : 1}">${p.dq ? 'Reinstate' : 'Disqualify'}</button><button class="xs" data-act="del" data-id="${p.id}">Remove</button></td></tr>`;
      }).join('')
      : '<tr><td class="muted">No players yet.</td></tr>';
  }

  // ------------------------------------------------------------ actions
  $('players').onclick = async (e) => {
    const b = e.target.closest('button'); if (!b) return;
    const id = b.dataset.id;
    if (b.dataset.act === 'dq') await api(`/admin/api/player/${id}/disqualify`, { value: b.dataset.v === '1' });
    if (b.dataset.act === 'del') { if (!confirm('Remove this player and all their scans?')) return; await api(`/admin/api/player/${id}/delete`, {}); }
    refresh();
  };
  $('bGame').onclick = async () => { await api('/admin/api/game', { open: !S.gameOpen }); refresh(); };
  $('bOut').onclick = async () => { if (es) es.close(); await api('/admin/api/logout', {}); showLogin(); };
  $('bSound').onclick = () => { soundOn = !soundOn; $('bSound').textContent = soundOn ? '🔊 Sound on' : '🔇 Sound off'; if (soundOn) { ensureAudio(); beep('scan'); } };
  $('bAlert').onclick = async () => {
    ensureAudio();
    if (!('Notification' in window)) { toast('This browser cannot show alerts. Keep this page open, or use ntfy/Telegram push.', ''); return; }
    const p = await Notification.requestPermission();
    toast(p === 'granted' ? 'Alerts enabled while this page is open in the background.' : 'Alerts blocked in browser settings.', '');
  };
  $('bLinks').onclick = async () => {
    const r = await api('/admin/api/links');
    if (r.status !== 200) return;
    $('links').innerHTML = r.links.map((l) => `<span class="link"><b>#${l.n} "${esc(l.letter)}"</b><br>${esc(l.url)}</span>`).join('');
  };
  $('bReset').onclick = async () => {
    $('rerr').textContent = '';
    if ($('rconf').value !== 'RESET') { $('rerr').textContent = 'Type RESET (capital letters) first.'; return; }
    if (!confirm('This deletes ALL players, scans and winners. Continue?')) return;
    const r = await api('/admin/api/reset', { confirm: 'RESET' });
    if (r.ok) { $('rconf').value = ''; $('rerr').textContent = 'Game reset.'; $('feed').innerHTML = ''; refresh(); }
  };

  start();
})();

/**
 * MR. DOOD – PREMIUM INTERACTIVE QR LETTER HUNT EXPERIENCE
 * Pure Client-Side Game Engine
 * No database or backend required. All progress saved in localStorage.
 */

(function () {
  'use strict';

  // --- GAME CONSTANTS ---
  const TARGET_WORD = ['M', 'R', '.', 'D', 'O', 'O', 'D'];
  const TOTAL_LETTERS = TARGET_WORD.length;
  const STORAGE_KEY = 'mrdood_hunt_player';
  const AUDIO_KEY = 'mrdood_audio_enabled';

  // --- SOUND EFFECTS (Web Audio API Synthesizer) ---
  class SoundManager {
    constructor() {
      this.enabled = localStorage.getItem(AUDIO_KEY) !== 'false';
      this.ctx = null;
    }

    init() {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) {
          this.ctx = new AudioCtx();
        }
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
    }

    toggle() {
      this.enabled = !this.enabled;
      localStorage.setItem(AUDIO_KEY, this.enabled ? 'true' : 'false');
      return this.enabled;
    }

    playTone(freq, type = 'sine', duration = 0.15, gainVal = 0.25) {
      if (!this.enabled) return;
      this.init();
      if (!this.ctx) return;
      try {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        gain.gain.setValueAtTime(gainVal, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + duration);
      } catch (e) {}
    }

    playClick() {
      this.playTone(600, 'triangle', 0.08, 0.2);
    }

    playScanBeep() {
      if (!this.enabled) return;
      this.init();
      if (!this.ctx) return;
      try {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(900, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1600, this.ctx.currentTime + 0.12);
        gain.gain.setValueAtTime(0.25, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.12);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.12);
      } catch (e) {}
    }

    playUnlock() {
      if (!this.enabled) return;
      this.init();
      if (!this.ctx) return;
      // Sparkling magical arpeggio (E5, G#5, B5, E6)
      const notes = [659.25, 830.61, 987.77, 1318.51];
      notes.forEach((freq, i) => {
        setTimeout(() => {
          this.playTone(freq, 'triangle', 0.35, 0.2);
        }, i * 75);
      });
    }

    playCollect() {
      if (!this.enabled) return;
      this.init();
      if (!this.ctx) return;
      try {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(880, this.ctx.currentTime + 0.18);
        gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.22);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.22);
      } catch (e) {}
    }

    playWarning() {
      this.playTone(280, 'sawtooth', 0.18, 0.15);
      setTimeout(() => this.playTone(220, 'sawtooth', 0.22, 0.15), 120);
    }

    playVictory() {
      if (!this.enabled) return;
      this.init();
      if (!this.ctx) return;
      // Grand celebratory brass fanfare
      const melody = [
        { f: 523.25, d: 0.18 }, // C5
        { f: 659.25, d: 0.18 }, // E5
        { f: 783.99, d: 0.18 }, // G5
        { f: 1046.50, d: 0.55 }, // C6
        { f: 880.00, d: 0.25 }, // A5
        { f: 1046.50, d: 0.8 }  // C6 hold
      ];
      let delay = 0;
      melody.forEach(item => {
        setTimeout(() => {
          this.playTone(item.f, 'triangle', item.d, 0.35);
        }, delay);
        delay += (item.d * 1000) * 0.85;
      });
    }
  }

  const sound = new SoundManager();

  // Trigger gentle vibration if supported
  function vibrate(pattern) {
    if ('vibrate' in navigator) {
      try {
        navigator.vibrate(pattern);
      } catch (e) {}
    }
  }

  // --- CONFETTI ENGINE ---
  class ConfettiEngine {
    constructor(canvasId) {
      this.canvas = document.getElementById(canvasId);
      this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
      this.particles = [];
      this.animId = null;
      this.active = false;
      this.resize();
      window.addEventListener('resize', () => this.resize());
    }

    resize() {
      if (!this.canvas) return;
      this.canvas.width = window.innerWidth;
      this.canvas.height = window.innerHeight;
    }

    burst(count = 50, originX = window.innerWidth / 2, originY = window.innerHeight / 2) {
      if (!this.ctx) return;
      const colors = ['#8CC63F', '#B7E44A', '#FF9F43', '#FFD166', '#FFFFFF', '#45B649'];
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 4 + Math.random() * 8;
        this.particles.push({
          x: originX,
          y: originY,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 3,
          size: 6 + Math.random() * 8,
          color: colors[Math.floor(Math.random() * colors.length)],
          rotation: Math.random() * 360,
          rotSpeed: (Math.random() - 0.5) * 12,
          alpha: 1,
          decay: 0.015 + Math.random() * 0.02
        });
      }
      if (!this.active) {
        this.active = true;
        this.loop();
      }
    }

    startContinuous() {
      if (!this.ctx) return;
      this.particles = [];
      const colors = ['#8CC63F', '#B7E44A', '#FF9F43', '#FFD166', '#FFFFFF', '#45B649'];
      for (let i = 0; i < 90; i++) {
        this.particles.push({
          x: Math.random() * this.canvas.width,
          y: Math.random() * -this.canvas.height,
          vx: (Math.random() - 0.5) * 2,
          vy: 2 + Math.random() * 3.5,
          size: 7 + Math.random() * 8,
          color: colors[Math.floor(Math.random() * colors.length)],
          rotation: Math.random() * 360,
          rotSpeed: (Math.random() - 0.5) * 8,
          alpha: 1,
          continuous: true
        });
      }
      if (!this.active) {
        this.active = true;
        this.loop();
      }
    }

    stop() {
      this.active = false;
      if (this.animId) {
        cancelAnimationFrame(this.animId);
        this.animId = null;
      }
      if (this.ctx) {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      }
      this.particles = [];
    }

    loop() {
      if (!this.active || !this.ctx) return;
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

      for (let i = this.particles.length - 1; i >= 0; i--) {
        const p = this.particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.rotation += p.rotSpeed;

        if (p.continuous) {
          if (p.y > this.canvas.height + 20) {
            p.y = -20;
            p.x = Math.random() * this.canvas.width;
          }
        } else {
          p.vy += 0.2; // gravity
          p.alpha -= p.decay;
          if (p.alpha <= 0) {
            this.particles.splice(i, 1);
            continue;
          }
        }

        this.ctx.save();
        this.ctx.translate(p.x, p.y);
        this.ctx.rotate((p.rotation * Math.PI) / 180);
        this.ctx.globalAlpha = p.alpha;
        this.ctx.fillStyle = p.color;
        this.ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.7);
        this.ctx.restore();
      }

      if (this.particles.length > 0 || this.active) {
        this.animId = requestAnimationFrame(() => this.loop());
      }
    }
  }

  const confetti = new ConfettiEngine('confetti-canvas');

  // --- GAME STATE MANAGEMENT ---
  function getGameState() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (data) {
        return JSON.parse(data);
      }
    } catch (e) {}
    return null;
  }

  function saveGameState(state) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {}
  }

  function clearGameState() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {}
  }

  function generateTicketId() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let s1 = '', s2 = '';
    for (let i = 0; i < 4; i++) s1 += chars[Math.floor(Math.random() * chars.length)];
    for (let i = 0; i < 4; i++) s2 += chars[Math.floor(Math.random() * chars.length)];
    return `MD-${s1}-${s2}`;
  }

  function formatDuration(ms) {
    if (!ms || ms < 0) return '00:00';
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  // --- QR CODE PARSER ---
  // Intelligently maps any scanned string to the corresponding character slot.
  // Supports:
  // - Direct index numbers: 1 to 7
  // - URL paths: /1/, /2/, ... /7/
  // - URL params: ?q=1, ?scan=1, ?id=1, ?letter=M
  // - Raw character match: M, R, ., D, O (assigns next available slot for duplicate characters)
  // - Formats like QR1, QR-1, MRDOOD_1
  function parseScannedCode(rawStr, currentCollected) {
    if (!rawStr) return null;
    const str = String(rawStr).trim();

    // 1. Try URL parsing
    try {
      const url = new URL(str, window.location.origin);
      // Path like /1/ or /1
      const pathMatch = url.pathname.match(/\/?([1-7])\/?$/);
      if (pathMatch) {
        const num = parseInt(pathMatch[1], 10);
        return { slotIndex: num - 1, character: TARGET_WORD[num - 1], codeId: num };
      }
      // Query param like ?q=1 or ?scan=1 or ?id=1
      const q = url.searchParams.get('q') || url.searchParams.get('scan') || url.searchParams.get('id');
      if (q && /^[1-7]$/.test(q)) {
        const num = parseInt(q, 10);
        return { slotIndex: num - 1, character: TARGET_WORD[num - 1], codeId: num };
      }
      // Query param like ?letter=M or ?c=M
      const l = url.searchParams.get('letter') || url.searchParams.get('c');
      if (l) {
        return resolveLetterToSlot(l, currentCollected);
      }
    } catch (e) {}

    // 2. Direct single digit 1..7
    if (/^[1-7]$/.test(str)) {
      const num = parseInt(str, 10);
      return { slotIndex: num - 1, character: TARGET_WORD[num - 1], codeId: num };
    }

    // 3. Patterns like QR1, QR-1, CARD_1, #1
    const pMatch = str.match(/(?:qr|code|letter|num|slot|card|#)[-_ ]*([1-7])/i);
    if (pMatch) {
      const num = parseInt(pMatch[1], 10);
      return { slotIndex: num - 1, character: TARGET_WORD[num - 1], codeId: num };
    }

    // 4. Raw letter matching
    return resolveLetterToSlot(str, currentCollected);
  }

  function resolveLetterToSlot(letterStr, currentCollected) {
    const rawChar = letterStr.trim().toUpperCase();
    if (rawChar === '.') {
      return { slotIndex: 2, character: '.', codeId: 3 };
    }
    if (rawChar === 'M') {
      return { slotIndex: 0, character: 'M', codeId: 1 };
    }
    if (rawChar === 'R') {
      return { slotIndex: 1, character: 'R', codeId: 2 };
    }
    if (rawChar === 'D') {
      // Slot 3 or Slot 6
      if (!currentCollected[3]) {
        return { slotIndex: 3, character: 'D', codeId: 4 };
      }
      if (!currentCollected[6]) {
        return { slotIndex: 6, character: 'D', codeId: 7 };
      }
      return { slotIndex: 3, character: 'D', codeId: 4, isDuplicate: true };
    }
    if (rawChar === 'O') {
      // Slot 4 or Slot 5
      if (!currentCollected[4]) {
        return { slotIndex: 4, character: 'O', codeId: 5 };
      }
      if (!currentCollected[5]) {
        return { slotIndex: 5, character: 'O', codeId: 6 };
      }
      return { slotIndex: 4, character: 'O', codeId: 5, isDuplicate: true };
    }
    return null;
  }

  // --- CAMERA QR SCANNER MANAGER ---
  class CameraScanner {
    constructor(onScanSuccess, onScanError) {
      this.onScanSuccess = onScanSuccess;
      this.onScanError = onScanError;
      this.video = document.getElementById('camera-video');
      this.canvas = document.getElementById('camera-canvas');
      this.ctx = this.canvas ? this.canvas.getContext('2d', { willReadFrequently: true }) : null;
      this.overlay = document.getElementById('scanner-overlay');
      this.stream = null;
      this.animId = null;
      this.scanning = false;
      this.facingMode = 'environment';
      this.torchOn = false;
      this.videoTrack = null;
    }

    async start() {
      sound.playClick();
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert('Camera access is not supported by your browser. You can use the QR test hub or image upload fallback.');
        return;
      }

      this.overlay.classList.add('active');
      this.scanning = true;

      try {
        const constraints = {
          video: {
            facingMode: { ideal: this.facingMode },
            width: { ideal: 1280 },
            height: { ideal: 720 }
          },
          audio: false
        };
        this.stream = await navigator.mediaDevices.getUserMedia(constraints);
        this.video.srcObject = this.stream;
        this.video.setAttribute('playsinline', true);
        await this.video.play();

        const tracks = this.stream.getVideoTracks();
        if (tracks.length > 0) {
          this.videoTrack = tracks[0];
        }

        this.loop();
      } catch (err) {
        console.error('Camera open error:', err);
        this.stop();
        alert('Could not start camera. Please ensure camera permissions are enabled in your mobile browser settings.');
      }
    }

    stop() {
      this.scanning = false;
      if (this.animId) {
        cancelAnimationFrame(this.animId);
        this.animId = null;
      }
      if (this.stream) {
        this.stream.getTracks().forEach(track => track.stop());
        this.stream = null;
      }
      if (this.video) {
        this.video.srcObject = null;
      }
      this.overlay.classList.remove('active');
      this.videoTrack = null;
      this.torchOn = false;
    }

    toggleCamera() {
      sound.playClick();
      this.facingMode = this.facingMode === 'environment' ? 'user' : 'environment';
      this.stop();
      this.start();
    }

    async toggleTorch() {
      sound.playClick();
      if (!this.videoTrack) return;
      try {
        const capabilities = this.videoTrack.getCapabilities ? this.videoTrack.getCapabilities() : {};
        if (capabilities.torch) {
          this.torchOn = !this.torchOn;
          await this.videoTrack.applyConstraints({
            advanced: [{ torch: this.torchOn }]
          });
        } else {
          alert('Torch flashlight is not supported on this camera.');
        }
      } catch (e) {
        console.warn('Torch toggle failed:', e);
      }
    }

    loop() {
      if (!this.scanning) return;

      if (this.video.readyState === this.video.HAVE_ENOUGH_DATA) {
        this.canvas.width = this.video.videoWidth;
        this.canvas.height = this.video.videoHeight;
        this.ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);

        const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
        
        // Scan with jsQR (loaded locally)
        if (window.jsQR) {
          const code = window.jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'dontInvert'
          });

          if (code && code.data) {
            sound.playScanBeep();
            vibrate([40, 30, 60]);
            this.stop();
            this.onScanSuccess(code.data);
            return;
          }
        }
      }

      this.animId = requestAnimationFrame(() => this.loop());
    }

    scanFromFile(file) {
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          this.canvas.width = img.width;
          this.canvas.height = img.height;
          this.ctx.drawImage(img, 0, 0);
          const imageData = this.ctx.getImageData(0, 0, img.width, img.height);
          if (window.jsQR) {
            const code = window.jsQR(imageData.data, imageData.width, imageData.height);
            if (code && code.data) {
              sound.playScanBeep();
              vibrate([40, 30, 60]);
              this.onScanSuccess(code.data);
            } else {
              alert('No QR code detected in this image. Please try a clearer picture.');
            }
          }
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    }
  }

  // --- LEADERBOARD & SPEEDRUN MANAGER ---
  const LEADERBOARD_KEY = 'mrdood_hunt_leaderboard';

  const DEFAULT_LEADERBOARD = [
    { id: 'lb-1', name: 'Kavindu P.', timeMs: 142000, letters: 7, ticket: 'MD-8F2A-91K2', date: 'AccroNex Champion', claimed: true },
    { id: 'lb-2', name: 'Tharushi M.', timeMs: 178000, letters: 7, ticket: 'MD-3C91-44B8', date: 'AccroNex Champion', claimed: true },
    { id: 'lb-3', name: 'Sulaxshan L.', timeMs: 209000, letters: 7, ticket: 'MD-7D15-38E2', date: 'AccroNex Champion', claimed: true },
    { id: 'lb-4', name: 'Naveen K.', timeMs: 245000, letters: 7, ticket: 'MD-2B88-11L9', date: 'AccroNex Champion', claimed: true },
    { id: 'lb-5', name: 'Dinuka S.', timeMs: 284000, letters: 7, ticket: 'MD-6E44-90T1', date: 'AccroNex Champion', claimed: false },
    { id: 'lb-6', name: 'Aathavan R.', timeMs: 319000, letters: 7, ticket: 'MD-5F72-23P4', date: 'AccroNex Champion', claimed: false },
    { id: 'lb-7', name: 'Senuri W.', timeMs: 362000, letters: 7, ticket: 'MD-9A10-55R7', date: 'AccroNex Champion', claimed: false }
  ];

  class LeaderboardManager {
    constructor() {
      this.modal = document.getElementById('leaderboard-modal');
      this.podiumEl = document.getElementById('podium-stage-area');
      this.listEl = document.getElementById('leaderboard-list-area');
      this.footerEl = document.getElementById('leaderboard-footer-user');
    }

    getEntries() {
      try {
        const stored = localStorage.getItem(LEADERBOARD_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed.sort((a, b) => a.timeMs - b.timeMs);
          }
        }
      } catch (e) {}
      this.saveEntries(DEFAULT_LEADERBOARD);
      return [...DEFAULT_LEADERBOARD].sort((a, b) => a.timeMs - b.timeMs);
    }

    saveEntries(entries) {
      try {
        localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(entries));
      } catch (e) {}
    }

    addPlayerScore(playerState) {
      if (!playerState || !playerState.completedAt || !playerState.startedAt) return null;
      const durationMs = Math.max(1000, playerState.completedAt - playerState.startedAt);
      const entries = this.getEntries();

      // Check if entry for this player or ticket already exists
      const existingIdx = entries.findIndex(e => 
        (playerState.ticketCode && e.ticket === playerState.ticketCode) ||
        (e.isCurrentPlayer && e.name.toLowerCase() === playerState.name.trim().toLowerCase())
      );

      const newEntry = {
        id: 'p-' + Date.now(),
        name: playerState.name.trim(),
        timeMs: durationMs,
        letters: 7,
        ticket: playerState.ticketCode || 'MD-WINNER',
        date: new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
        claimed: false,
        isCurrentPlayer: true
      };

      if (existingIdx >= 0) {
        if (durationMs < entries[existingIdx].timeMs) {
          entries[existingIdx].timeMs = durationMs;
          entries[existingIdx].date = newEntry.date;
        }
      } else {
        entries.push(newEntry);
      }

      entries.sort((a, b) => a.timeMs - b.timeMs);
      this.saveEntries(entries);

      const rank = entries.findIndex(e => e.ticket === newEntry.ticket || e.id === newEntry.id) + 1;
      return { rank, total: entries.length, durationMs };
    }

    getPlayerRank(playerState) {
      if (!playerState || !playerState.completedAt) return null;
      const entries = this.getEntries();
      const idx = entries.findIndex(e => 
        (playerState.ticketCode && e.ticket === playerState.ticketCode) ||
        (e.name.toLowerCase() === playerState.name.trim().toLowerCase())
      );
      return idx >= 0 ? idx + 1 : null;
    }

    open(currentPlayerState) {
      this.render(currentPlayerState);
      this.modal?.classList.add('active');
    }

    close() {
      this.modal?.classList.remove('active');
    }

    reset() {
      this.saveEntries(DEFAULT_LEADERBOARD);
    }

    render(currentPlayerState) {
      const entries = this.getEntries();
      if (!this.podiumEl || !this.listEl) return;

      const first = entries[0] || null;
      const second = entries[1] || null;
      const third = entries[2] || null;

      const renderPodiumCol = (entry, place, type, medal) => {
        if (!entry) return `<div class="podium-column ${type}"></div>`;
        const initials = (entry.name || 'P').slice(0, 2).toUpperCase();
        return `
          <div class="podium-column ${type}">
            <div class="podium-avatar-wrap">
              ${type === 'gold' ? '<div class="podium-crown">👑</div>' : ''}
              <div class="podium-avatar">${initials}</div>
            </div>
            <div class="podium-name">${this.escapeHtml(entry.name)}</div>
            <div class="podium-time">${formatDuration(entry.timeMs)}</div>
            <div class="podium-pedestal">${medal}</div>
          </div>
        `;
      };

      this.podiumEl.innerHTML = `
        ${renderPodiumCol(second, 2, 'silver', '2')}
        ${renderPodiumCol(first, 1, 'gold', '1')}
        ${renderPodiumCol(third, 3, 'bronze', '3')}
      `;

      const rest = entries.slice(3);
      if (rest.length === 0) {
        this.listEl.innerHTML = `
          <div style="text-align:center; padding:20px; color:rgba(255,255,255,0.5); font-size:0.85rem;">
            No other ranked speedrunners yet! Complete all 7 letters to rank here!
          </div>
        `;
      } else {
        this.listEl.innerHTML = rest.map((entry, idx) => {
          const rankNum = idx + 4;
          const isUser = (currentPlayerState && currentPlayerState.name && 
            entry.name.toLowerCase() === currentPlayerState.name.trim().toLowerCase());
          const initials = (entry.name || 'P').slice(0, 2).toUpperCase();

          return `
            <div class="rank-row ${isUser ? 'is-current-user' : ''}">
              <div class="rank-pos">#${rankNum}</div>
              <div class="player-avatar" style="width:34px; height:34px; font-size:0.85rem; flex-shrink:0;">${initials}</div>
              <div class="rank-info">
                <div class="rank-name-row">
                  <span class="rank-player-name">${this.escapeHtml(entry.name)}</span>
                  ${isUser ? '<span class="you-pill">YOU</span>' : ''}
                </div>
                <div class="rank-meta">7/7 Letters • ${entry.date || 'Verified'}</div>
              </div>
              <div class="rank-time-pill">${formatDuration(entry.timeMs)}</div>
            </div>
          `;
        }).join('');
      }

      if (this.footerEl) {
        if (currentPlayerState && currentPlayerState.completedAt) {
          const rank = this.getPlayerRank(currentPlayerState) || 1;
          const duration = currentPlayerState.completedAt - currentPlayerState.startedAt;
          this.footerEl.innerHTML = `
            <div class="footer-user-left">
              <div class="player-avatar" style="width:36px; height:36px;">
                ${(currentPlayerState.name || 'E').slice(0, 2).toUpperCase()}
              </div>
              <div class="footer-user-info">
                <p>YOUR SPEEDRUN RANK</p>
                <strong>#${rank} of ${entries.length} Champions</strong>
              </div>
            </div>
            <div class="rank-time-pill" style="font-size:0.92rem; border-color:var(--lime);">
              ⏱️ ${formatDuration(duration)}
            </div>
          `;
        } else if (currentPlayerState && currentPlayerState.name) {
          const count = (currentPlayerState.collected || []).filter(Boolean).length;
          this.footerEl.innerHTML = `
            <div class="footer-user-left">
              <div class="player-avatar" style="width:36px; height:36px;">
                ${(currentPlayerState.name || 'E').slice(0, 2).toUpperCase()}
              </div>
              <div class="footer-user-info">
                <p>HUNT IN PROGRESS</p>
                <strong>${count} of 7 Letters Found</strong>
              </div>
            </div>
            <span style="font-size:0.75rem; color:var(--lime); font-weight:700;">
              Finish to rank! ⚡
            </span>
          `;
        } else {
          this.footerEl.innerHTML = `
            <div style="font-size:0.8rem; color:rgba(255,255,255,0.7); width:100%; text-align:center;">
              Start playing to record your name on the Leaderboard!
            </div>
          `;
        }
      }
    }

    escapeHtml(str) {
      return String(str || '').replace(/[&<>"']/g, c => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      }[c]));
    }
  }

  // --- UI APPLICATION CONTROLLER ---
  class MrDoodApp {
    constructor() {
      this.appEl = document.getElementById('app-view');
      this.state = getGameState();
      this.leaderboard = new LeaderboardManager();
      this.scanner = new CameraScanner(
        (data) => this.handleScannedData(data),
        (err) => console.warn(err)
      );
      this.currentPendingUnlock = null;
      this.antiTamperInterval = null;

      this.initEvents();
      this.checkUrlParams();
      this.render();
    }

    initEvents() {
      // Leaderboard Modal Controls
      document.getElementById('leaderboard-toggle-btn')?.addEventListener('click', () => {
        sound.playClick();
        this.leaderboard.open(this.state);
      });

      document.getElementById('leaderboard-close-btn')?.addEventListener('click', () => {
        sound.playClick();
        this.leaderboard.close();
      });

      // Audio toggle button
      const soundBtn = document.getElementById('sound-toggle-btn');
      if (soundBtn) {
        soundBtn.addEventListener('click', () => {
          const on = sound.toggle();
          soundBtn.innerHTML = on ? '🔊' : '🔇';
          soundBtn.title = on ? 'Sound Effects Enabled' : 'Sound Muted';
          if (on) sound.playClick();
        });
        soundBtn.innerHTML = sound.enabled ? '🔊' : '🔇';
      }

      // Organizer Drawer button
      const orgBtn = document.getElementById('organizer-toggle-btn');
      if (orgBtn) {
        orgBtn.addEventListener('click', () => {
          sound.playClick();
          this.openOrganizerDrawer();
        });
      }

      // Scanner Controls
      document.getElementById('scanner-close-btn')?.addEventListener('click', () => {
        sound.playClick();
        this.scanner.stop();
      });

      document.getElementById('scanner-flip-btn')?.addEventListener('click', () => {
        this.scanner.toggleCamera();
      });

      document.getElementById('scanner-torch-btn')?.addEventListener('click', () => {
        this.scanner.toggleTorch();
      });

      // Photo upload scanner fallback
      const fileInput = document.getElementById('scanner-file-input');
      document.getElementById('scanner-upload-btn')?.addEventListener('click', () => {
        sound.playClick();
        fileInput?.click();
      });

      fileInput?.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
          this.scanner.stop();
          this.scanner.scanFromFile(e.target.files[0]);
        }
      });

      // Discovery Modal Collect Button
      document.getElementById('discovery-collect-btn')?.addEventListener('click', () => {
        this.collectPendingLetter();
      });

      // Warning Modal Close
      document.getElementById('warning-close-btn')?.addEventListener('click', () => {
        sound.playClick();
        document.getElementById('warning-modal')?.classList.remove('active');
      });

      // Reward Pass Modal Close
      document.getElementById('reward-pass-close-btn')?.addEventListener('click', () => {
        sound.playClick();
        document.getElementById('reward-pass-overlay')?.classList.remove('active');
      });

      // Drawer Close
      document.getElementById('drawer-close-btn')?.addEventListener('click', () => {
        sound.playClick();
        document.getElementById('organizer-drawer')?.classList.remove('active');
      });
    }

    checkUrlParams() {
      // Check if user came from a native camera scan (e.g. ?scan=2 or ?q=2)
      const params = new URLSearchParams(window.location.search);
      const scanCode = params.get('scan') || params.get('q') || params.get('letter') || params.get('c');
      if (scanCode) {
        // Clean URL without reload
        history.replaceState(null, '', window.location.pathname);
        setTimeout(() => {
          this.handleScannedData(scanCode);
        }, 350);
      }
    }

    // --- SCREEN RENDERER ---
    render() {
      if (!this.state || !this.state.name) {
        this.renderWelcomeScreen();
      } else if (this.state.completedAt) {
        this.renderVictoryScreen();
      } else {
        this.renderDashboardScreen();
      }
    }

    // =========================================================================
    // 1. WELCOME SCREEN
    // =========================================================================
    renderWelcomeScreen() {
      this.appEl.innerHTML = `
        <div class="welcome-screen">
          <div class="welcome-badge">Official Event Activation</div>

          <!-- Mascot Stage with Floating 3D Grocery Illustrations -->
          <div class="mascot-stage">
            <div class="mascot-halo"></div>
            <img class="main-mascot" src="assets/logo.png" alt="Mr. Dood Logo">
            
            <!-- Floating Fresh Produce SVGs -->
            <div class="floating-item item-apple">
              <svg viewBox="0 0 40 40" width="100%" height="100%">
                <circle cx="20" cy="22" r="16" fill="#ef4444"/>
                <ellipse cx="16" cy="18" rx="11" ry="13" fill="#f87171"/>
                <path d="M20 7 Q21 2 26 4 Q25 8 20 8 Z" fill="#84cc16"/>
                <path d="M20 10 Q21 4 21 2" stroke="#78350f" stroke-width="2.5" stroke-linecap="round"/>
                <ellipse cx="14" cy="16" rx="3.5" ry="5" fill="#ffffff" opacity="0.4" transform="rotate(-20 14 16)"/>
              </svg>
            </div>

            <div class="floating-item item-carrot">
              <svg viewBox="0 0 40 40" width="100%" height="100%">
                <path d="M20 36 C17 30 14 20 13 14 C12 8 26 8 25 14 C24 20 21 30 20 36 Z" fill="#f97316"/>
                <path d="M16 12 Q20 2 15 2 Q18 6 18 11" stroke="#84cc16" stroke-width="2.5" fill="none"/>
                <path d="M20 12 Q22 0 25 2 Q22 6 21 11" stroke="#84cc16" stroke-width="2.5" fill="none"/>
              </svg>
            </div>

            <div class="floating-item item-orange">
              <svg viewBox="0 0 40 40" width="100%" height="100%">
                <circle cx="20" cy="20" r="16" fill="#f59e0b"/>
                <circle cx="20" cy="20" r="13" fill="#fbbf24"/>
                <circle cx="20" cy="20" r="4" fill="#fef3c7"/>
                <ellipse cx="14" cy="14" rx="3" ry="4" fill="#ffffff" opacity="0.4" transform="rotate(-30 14 14)"/>
              </svg>
            </div>

            <div class="floating-item item-broccoli">
              <svg viewBox="0 0 40 40" width="100%" height="100%">
                <circle cx="15" cy="16" r="9" fill="#65a30d"/>
                <circle cx="25" cy="16" r="9" fill="#84cc16"/>
                <circle cx="20" cy="12" r="10" fill="#4d7c0f"/>
                <path d="M18 22 C18 28 17 34 20 36 C23 34 22 28 22 22 Z" fill="#a3e635"/>
              </svg>
            </div>

            <div class="floating-item item-star-1">
              <svg viewBox="0 0 24 24" width="100%" height="100%">
                <path d="M12 2 L14.5 9.5 L22 12 L14.5 14.5 L12 22 L9.5 14.5 L2 12 L9.5 9.5 Z" fill="#FFD166"/>
              </svg>
            </div>

            <div class="floating-item item-star-2">
              <svg viewBox="0 0 24 24" width="100%" height="100%">
                <path d="M12 2 L14.5 9.5 L22 12 L14.5 14.5 L12 22 L9.5 14.5 L2 12 L9.5 9.5 Z" fill="#FF9F43"/>
              </svg>
            </div>
          </div>

          <h1 class="welcome-title">READY FOR A <span>FRESH CHALLENGE?</span></h1>
          <p class="welcome-sub">Find 7 hidden letters. Build <strong>MR.DOOD</strong>. Win exciting prizes!</p>

          <div class="game-card" style="width: 100%;">
            <form id="start-game-form" onsubmit="return false;">
              <div class="name-input-group">
                <div class="input-icon-box">🎒</div>
                <input 
                  type="text" 
                  id="player-name-input" 
                  class="player-input" 
                  maxlength="20" 
                  placeholder="What's your name, explorer?" 
                  autocomplete="name"
                  autofocus
                  required
                >
              </div>

              <button type="submit" id="start-btn" class="btn-primary">
                <span>LET'S PLAY!</span> 🚀
              </button>
            </form>
          </div>

          <div class="rules-strip">
            <div class="rule-dot"><i>🔍</i> 7 Hidden QRs</div>
            <div class="rule-dot"><i>⚡</i> Any Order</div>
            <div class="rule-dot"><i>🎁</i> Win Prizes</div>
          </div>
        </div>
      `;

      // Start form submit
      const form = document.getElementById('start-game-form');
      const input = document.getElementById('player-name-input');
      form.addEventListener('submit', () => {
        const name = input.value.trim();
        if (!name) {
          input.focus();
          return;
        }
        sound.playUnlock();
        vibrate([50, 50]);
        this.state = {
          name: name,
          collected: Array(TOTAL_LETTERS).fill(false),
          startedAt: Date.now(),
          completedAt: null,
          ticketCode: null
        };
        saveGameState(this.state);
        this.render();
      });
    }

    // =========================================================================
    // 2. MAIN GAMEPLAY DASHBOARD
    // =========================================================================
    renderDashboardScreen() {
      const collectedCount = this.state.collected.filter(Boolean).length;
      const progressPercent = Math.round((collectedCount / TOTAL_LETTERS) * 100);
      const remainingCount = TOTAL_LETTERS - collectedCount;
      const initials = (this.state.name || 'E').slice(0, 2).toUpperCase();

      this.appEl.innerHTML = `
        <div class="dashboard-screen">
          
          <!-- Top Section Player Info -->
          <div class="top-bar" style="padding-top: 0;">
            <div class="player-chip">
              <div class="player-avatar">${initials}</div>
              <div class="player-name-text">${this.escapeHtml(this.state.name)}</div>
            </div>
            <div class="hero-tag" style="margin: 0;">
              ${collectedCount === 0 ? '🟢 READY TO SCAN' : `⚡ ${collectedCount}/7 UNLOCKED`}
            </div>
          </div>

          <!-- Hero Section -->
          <div class="hero-banner">
            <h2 class="hero-title">YOUR LETTER HUNT STARTS NOW!</h2>
            <p class="hero-desc">Collect all seven characters to unlock <strong>MR.DOOD</strong>.</p>
          </div>

          <!-- 3D COLLECTIBLE LETTER TILES SYSTEM -->
          <div class="collection-stage">
            <div class="collection-header">
              <div class="collection-badge-label">
                <span>🏆</span> COLLECTIBLE TILES
              </div>
              <div class="collection-count-pill" id="dashboard-counter-pill">
                ${collectedCount} OF ${TOTAL_LETTERS} COLLECTED
              </div>
            </div>

            <!-- 7 Collectible 3D Tiles -->
            <div class="slots-grid" id="slots-grid">
              ${TARGET_WORD.map((char, index) => {
                const isUnlocked = this.state.collected[index];
                return `
                  <div 
                    class="tile-box ${isUnlocked ? 'unlocked' : 'locked'}" 
                    id="tile-slot-${index}" 
                    data-slot="${index}"
                    title="${isUnlocked ? `Character: ${char}` : `Letter Slot ${index + 1}`}"
                  >
                    ${isUnlocked ? `
                      <span class="tile-char">${char}</span>
                      <span class="tile-check">✓</span>
                    ` : `
                      <span class="tile-question">?</span>
                      <span class="tile-index-tag">#${index + 1}</span>
                    `}
                  </div>
                `;
              }).join('')}
            </div>

            <!-- Stylish Progress Bar -->
            <div class="progress-bar-wrap">
              <div class="progress-track">
                <div class="progress-fill" id="dashboard-progress-fill" style="width: ${progressPercent}%;"></div>
              </div>
              <div class="progress-footer">
                <span>Progress: <strong id="progress-percent-text">${progressPercent}%</strong></span>
                <span><strong>${remainingCount}</strong> remaining</span>
              </div>
            </div>
          </div>

          <!-- MISSION & SCAN QR ACTION -->
          <div class="mission-card">
            <div class="mission-header">
              <div class="mission-icon-badge">🎯</div>
              <div class="mission-titles">
                <h3>MISSION ACTIVE</h3>
                <p>Locate QR codes placed around the venue</p>
              </div>
            </div>
            <p class="mission-body-text">
              Scan any Mr. Dood QR code in <strong>any order</strong>. Each valid code unlocks one character towards building <strong>MR.DOOD</strong>!
            </p>
            <button id="scan-qr-btn" class="scan-cta-btn">
              <span>📷 SCAN QR CODE</span>
              <div class="scanner-pulse"></div>
            </button>
          </div>

          <!-- Tips Footer -->
          <div class="tips-banner">
            <div class="tips-icon">💡</div>
            <div>
              <strong>Quick Tip:</strong> Codes can be scanned in any order! Double-scanning the same code is automatically protected.
            </div>
          </div>

          <!-- Leaderboard Shortcut Button -->
          <div style="margin-top: 14px; text-align: center;">
            <button id="dash-lb-btn" class="btn-secondary" style="background: rgba(255,255,255,0.7); border-radius: var(--radius-full); font-size: 0.85rem; padding: 10px 18px;">
              <span>🏆 View Top Speedrunners & Leaderboard</span>
            </button>
          </div>
        </div>
      `;

      // Scan QR code button
      document.getElementById('scan-qr-btn')?.addEventListener('click', () => {
        this.scanner.start();
      });

      // Leaderboard shortcut button
      document.getElementById('dash-lb-btn')?.addEventListener('click', () => {
        sound.playClick();
        this.leaderboard.open(this.state);
      });

      // Interactive tile clicks
      document.querySelectorAll('.tile-box').forEach(tile => {
        tile.addEventListener('click', () => {
          sound.playClick();
          const slot = parseInt(tile.dataset.slot, 10);
          if (this.state.collected[slot]) {
            vibrate([30]);
            tile.classList.add('just-unlocked');
            setTimeout(() => tile.classList.remove('just-unlocked'), 750);
          }
        });
      });
    }

    // =========================================================================
    // 3. LETTER DISCOVERY ANIMATION & FLOW (MOST IMPORTANT)
    // =========================================================================
    handleScannedData(rawCode) {
      if (!this.state || !this.state.name) {
        // Player not registered yet; store pending and prompt welcome
        const parsed = parseScannedCode(rawCode, Array(TOTAL_LETTERS).fill(false));
        if (parsed) {
          alert(`Great find! Enter your explorer name first to claim letter "${parsed.character}"!`);
        }
        return;
      }

      const parsed = parseScannedCode(rawCode, this.state.collected);

      if (!parsed) {
        sound.playWarning();
        vibrate([80, 80]);
        this.showWarning(
          'INVALID QR CODE 🔍',
          'That doesn\'t look like a valid Mr. Dood event code. Keep your eyes peeled around the booth and venue!'
        );
        return;
      }

      // Check if duplicate
      if (parsed.isDuplicate || this.state.collected[parsed.slotIndex]) {
        sound.playWarning();
        vibrate([60, 40, 60]);
        this.showWarning(
          'ALREADY COLLECTED! 🏃',
          `You've already found letter "${parsed.character}"! Keep moving and discover the remaining hidden letters!`
        );
        return;
      }

      // Valid new character found!
      this.currentPendingUnlock = parsed;
      this.openDiscoveryModal(parsed);
    }

    openDiscoveryModal(parsed) {
      sound.playUnlock();
      vibrate([50, 40, 90]);

      // Burst celebratory confetti around center
      confetti.burst(45);

      const modal = document.getElementById('discovery-modal');
      const letterEl = document.getElementById('discovery-letter-display');
      const posEl = document.getElementById('discovery-pos-info');
      const subEl = document.getElementById('discovery-sub-text');
      const bannerEl = document.getElementById('discovery-special-badge');

      letterEl.textContent = parsed.character;
      posEl.textContent = `Position ${parsed.slotIndex + 1} of 7 in MR.DOOD`;

      const collectedCount = this.state.collected.filter(Boolean).length;
      if (collectedCount + 1 === TOTAL_LETTERS) {
        bannerEl.style.display = 'inline-flex';
        bannerEl.textContent = '🌟 FINAL CHARACTER FOUND! 🌟';
        subEl.textContent = 'This completes the word MR.DOOD! Prepare for victory!';
      } else {
        bannerEl.style.display = 'none';
        subEl.textContent = 'One step closer to MR.DOOD!';
      }

      modal.classList.add('active');
    }

    collectPendingLetter() {
      if (!this.currentPendingUnlock) return;
      const parsed = this.currentPendingUnlock;
      this.currentPendingUnlock = null;

      const modal = document.getElementById('discovery-modal');
      modal.classList.remove('active');

      // Update state in localStorage
      this.state.collected[parsed.slotIndex] = true;
      const newCount = this.state.collected.filter(Boolean).length;
      if (newCount === TOTAL_LETTERS) {
        this.state.completedAt = Date.now();
        this.state.ticketCode = generateTicketId();
        // Record speedrun score on the Leaderboard
        this.leaderboard.addPlayerScore(this.state);
      }
      saveGameState(this.state);

      // Perform flying ghost animation into target tile
      this.animateTokenFlight(parsed.slotIndex, parsed.character, () => {
        sound.playCollect();
        vibrate([40, 60]);

        if (this.state.completedAt) {
          // Final 7th letter collected! Launch grand celebration
          setTimeout(() => {
            this.renderVictoryScreen();
          }, 650);
        } else {
          // Re-render dashboard to show freshly unlocked state
          this.renderDashboardScreen();
          const targetTile = document.getElementById(`tile-slot-${parsed.slotIndex}`);
          if (targetTile) {
            targetTile.classList.add('just-unlocked');
            setTimeout(() => targetTile.classList.remove('just-unlocked'), 750);
          }
        }
      });
    }

    animateTokenFlight(slotIndex, character, onComplete) {
      const targetTile = document.getElementById(`tile-slot-${slotIndex}`);
      if (!targetTile) {
        if (onComplete) onComplete();
        return;
      }

      const targetRect = targetTile.getBoundingClientRect();
      const startX = window.innerWidth / 2 - 35;
      const startY = window.innerHeight / 2 - 35;

      const ghost = document.createElement('div');
      ghost.className = 'flying-ghost-token';
      ghost.textContent = character;
      ghost.style.left = `${startX}px`;
      ghost.style.top = `${startY}px`;
      ghost.style.width = '70px';
      ghost.style.height = '70px';
      ghost.style.fontSize = '2.2rem';
      document.body.appendChild(ghost);

      // Trigger animation towards target tile
      requestAnimationFrame(() => {
        ghost.style.left = `${targetRect.left}px`;
        ghost.style.top = `${targetRect.top}px`;
        ghost.style.width = `${targetRect.width}px`;
        ghost.style.height = `${targetRect.height}px`;
        ghost.style.fontSize = '1.4rem';
        ghost.style.opacity = '0.9';
      });

      setTimeout(() => {
        ghost.remove();
        if (onComplete) onComplete();
      }, 650);
    }

    showWarning(title, message) {
      const modal = document.getElementById('warning-modal');
      const titleEl = document.getElementById('warning-title');
      const msgEl = document.getElementById('warning-msg');
      if (titleEl) titleEl.textContent = title;
      if (msgEl) msgEl.textContent = message;
      modal?.classList.add('active');
    }

    // =========================================================================
    // 4. FINAL VICTORY SCREEN
    // =========================================================================
    renderVictoryScreen() {
      sound.playVictory();
      vibrate([100, 50, 100, 50, 200]);

      // Start continuous celebratory confetti shower
      confetti.startContinuous();

      const durationMs = this.state.completedAt - this.state.startedAt;
      const formattedDuration = formatDuration(durationMs);
      const completionDate = new Date(this.state.completedAt).toLocaleString();
      const myRank = this.leaderboard.getPlayerRank(this.state) || 1;

      this.appEl.innerHTML = `
        <div class="victory-screen">
          <div class="victory-halo-top">
            <div class="victory-trophy-badge">🏆</div>
            <h1 class="victory-headline">YOU DID IT!</h1>
            <p class="victory-subheadline">All seven letters collected!</p>
          </div>

          <!-- Staggered dropping MR.DOOD Tiles -->
          <div class="mrdood-word-banner">
            ${TARGET_WORD.map((char, i) => `
              <div 
                class="victory-letter-tile" 
                style="animation-delay: ${i * 120}ms;"
              >
                ${char}
              </div>
            `).join('')}
          </div>

          <div class="hero-tag" style="margin-bottom: 8px;">
            🎉 MISSION COMPLETED!
          </div>

          <!-- Speedrun Rank Callout -->
          <div class="hero-tag" style="margin-bottom: 16px; background: rgba(255, 209, 102, 0.2); color: #f59e0b; border: 1.5px solid #f59e0b;">
            🏆 RANK #${myRank} ON SPEEDRUN LEADERBOARD (${formattedDuration})
          </div>

          <!-- Mission Stats Card -->
          <div class="stats-card">
            <div style="display: flex; align-items: center; justify-content: space-between;">
              <span style="font-weight: 800; font-size: 0.95rem; color: var(--lime);">
                EXPLORER CERTIFICATE
              </span>
              <span style="font-size: 0.8rem; background: rgba(255,255,255,0.15); padding: 2px 8px; border-radius: 9999px;">
                7 / 7 COLLECTED
              </span>
            </div>

            <div class="stats-grid">
              <div class="stat-item">
                <span class="stat-label">Explorer</span>
                <span class="stat-val">${this.escapeHtml(this.state.name)}</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">Total Time</span>
                <span class="stat-val">${formattedDuration}</span>
              </div>
              <div class="stat-item" style="grid-column: span 2;">
                <span class="stat-label">Completed Timestamp</span>
                <span class="stat-val" style="font-size: 0.85rem; color: #fff;">${completionDate}</span>
              </div>
            </div>
          </div>

          <!-- Prize Claim Card -->
          <div class="prize-claim-card">
            <h3>YOU'RE A MR. DOOD CHAMPION!</h3>
            <p>Show this screen to our event team and claim your prize!</p>
            <button id="show-reward-pass-btn" class="btn-primary btn-orange" style="margin-bottom: 10px;">
              <span>🌟 SHOW MY REWARD PASS</span>
            </button>
            <button id="view-victory-lb-btn" class="btn-primary" style="background: linear-gradient(180deg, #ffd166 0%, #f59e0b 100%); color: #101827; box-shadow: 0 6px 0 #b45309;">
              <span>🏆 VIEW FULL LEADERBOARD</span>
            </button>
          </div>

          <button id="play-again-reset-btn" class="btn-secondary" style="margin-top: 6px;">
            <span>🔄 Play Again (New Game)</span>
          </button>
        </div>
      `;

      // Reward Pass button
      document.getElementById('show-reward-pass-btn')?.addEventListener('click', () => {
        sound.playUnlock();
        this.openRewardPass();
      });

      // Victory Leaderboard button
      document.getElementById('view-victory-lb-btn')?.addEventListener('click', () => {
        sound.playClick();
        this.leaderboard.open(this.state);
      });

      // Play again
      document.getElementById('play-again-reset-btn')?.addEventListener('click', () => {
        if (confirm('Start a fresh new letter hunt? This will reset your current progress.')) {
          sound.playClick();
          confetti.stop();
          clearGameState();
          this.state = null;
          this.render();
        }
      });
    }

    // =========================================================================
    // 5. OFFICIAL REWARD PRESENTATION PASS
    // =========================================================================
    openRewardPass() {
      const overlay = document.getElementById('reward-pass-overlay');
      const nameEl = document.getElementById('pass-player-name-val');
      const ticketEl = document.getElementById('pass-ticket-val');
      const timeEl = document.getElementById('pass-live-time-val');

      if (nameEl) nameEl.textContent = this.state.name;
      if (ticketEl) ticketEl.textContent = this.state.ticketCode || 'MD-CHAMPION-2026';

      // Live anti-tamper security clock update
      if (this.antiTamperInterval) clearInterval(this.antiTamperInterval);
      const updateLiveClock = () => {
        const now = new Date();
        if (timeEl) {
          timeEl.textContent = `● LIVE VERIFICATION: ${now.toLocaleTimeString()} (${now.toLocaleDateString()})`;
        }
      };
      updateLiveClock();
      this.antiTamperInterval = setInterval(updateLiveClock, 1000);

      overlay?.classList.add('active');
    }

    // =========================================================================
    // 6. EVENT ORGANIZER & QR TEST HUB
    // =========================================================================
    openOrganizerDrawer() {
      const drawer = document.getElementById('organizer-drawer');
      const grid = document.getElementById('quick-test-btn-grid');
      const qrList = document.getElementById('qr-code-list-area');

      // Setup 7 quick simulate scan buttons
      if (grid) {
        grid.innerHTML = TARGET_WORD.map((char, index) => {
          const num = index + 1;
          const isDone = this.state && this.state.collected && this.state.collected[index];
          return `
            <button 
              class="quick-test-btn" 
              data-code="${num}" 
              style="${isDone ? 'background:#dcfce7; border-color:#86efac; color:#15803d;' : ''}"
              title="Test QR Code ${num} (${char})"
            >
              ${char}<br><small style="font-size:0.65rem;">QR ${num}</small>
            </button>
          `;
        }).join('');

        grid.querySelectorAll('.quick-test-btn').forEach(btn => {
          btn.addEventListener('click', () => {
            const code = btn.dataset.code;
            drawer.classList.remove('active');
            this.handleScannedData(code);
          });
        });
      }

      // Render actual scannable QR codes using qrcode.min.js
      if (qrList && window.QRCode) {
        qrList.innerHTML = '';
        TARGET_WORD.forEach((char, index) => {
          const num = index + 1;
          const card = document.createElement('div');
          card.className = 'qr-card-item';
          
          const thumb = document.createElement('div');
          thumb.className = 'qr-card-thumb';
          
          const info = document.createElement('div');
          info.className = 'qr-card-info';
          info.innerHTML = `
            <h4>QR Code ${num} • Letter "${char}"</h4>
            <p>Target Slot: ${num} of 7 in MR.DOOD</p>
          `;

          const testBtn = document.createElement('button');
          testBtn.className = 'btn-secondary';
          testBtn.style.padding = '6px 12px';
          testBtn.style.fontSize = '0.78rem';
          testBtn.textContent = 'Simulate Scan';
          testBtn.onclick = () => {
            drawer.classList.remove('active');
            this.handleScannedData(num);
          };
          info.appendChild(testBtn);

          card.appendChild(thumb);
          card.appendChild(info);
          qrList.appendChild(card);

          // Render live scannable QR
          const qrPayload = `${window.location.origin}${window.location.pathname}?scan=${num}`;
          new window.QRCode(thumb, {
            text: qrPayload,
            width: 80,
            height: 80,
            colorDark: '#101827',
            colorLight: '#ffffff',
            correctLevel: window.QRCode.CorrectLevel.M
          });
        });
      }

      // Drawer View Leaderboard Button
      const drawerLbBtn = document.getElementById('drawer-view-lb-btn');
      if (drawerLbBtn) {
        drawerLbBtn.onclick = () => {
          sound.playClick();
          drawer.classList.remove('active');
          this.leaderboard.open(this.state);
        };
      }

      // Drawer Reset Button
      const resetBtn = document.getElementById('drawer-reset-progress-btn');
      if (resetBtn) {
        resetBtn.onclick = () => {
          if (confirm('Reset current progress? You can test from the beginning.')) {
            sound.playClick();
            confetti.stop();
            clearGameState();
            this.state = null;
            drawer.classList.remove('active');
            this.render();
          }
        };
      }

      drawer?.classList.add('active');
    }

    escapeHtml(str) {
      return String(str || '').replace(/[&<>"']/g, c => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      }[c]));
    }
  }

  // Initialize game when DOM is loaded
  document.addEventListener('DOMContentLoaded', () => {
    window.mrDoodApp = new MrDoodApp();
  });
})();

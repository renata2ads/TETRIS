(function (exports) {
  'use strict';

  // Kolory klocków w kolejności I, O, T, S, Z, J, L — te same co na planszy.
  const COLORS = ['#00c8e0', '#f5d000', '#a040e0', '#30c050', '#e03a3a', '#3060e0', '#f08a20'];
  // Kształty w układzie [kolumna, wiersz].
  const SHAPES = [
    [[0, 0], [1, 0], [2, 0], [3, 0]],
    [[0, 0], [1, 0], [0, 1], [1, 1]],
    [[0, 0], [1, 0], [2, 0], [1, 1]],
    [[1, 0], [2, 0], [0, 1], [1, 1]],
    [[0, 0], [1, 0], [1, 1], [2, 1]],
    [[0, 0], [0, 1], [1, 1], [2, 1]],
    [[2, 0], [0, 1], [1, 1], [2, 1]],
  ];
  const LETTER_DELAY_MS = 90;

  // Natężenie animacji. Odstępy w ms: [najkrótszy, losowy dodatek].
  const FULL = { animate: true, maxPieces: 7, pieceGap: [2200, 2600], meteorGap: [4500, 5000], parallax: true, pieceAlpha: 0.9 };
  const CALM = { animate: true, maxPieces: 3, pieceGap: [5000, 3000], meteorGap: [10000, 5000], parallax: false, pieceAlpha: 0.55 };
  const STILL = { animate: false };
  const LEVELS = ['calm', 'full', 'off'];

  // mode: 'scene' (okna), 'game' (gra trwa), 'paused', 'dim' (koniec gry), 'off' (kosmos ukryty).
  // level: ustawienie gracza dla tła w trakcie gry — 'calm' | 'full' | 'off'.
  function profileFor(mode, level) {
    if (mode === 'off') return null;
    if (mode === 'scene') return FULL;
    if (mode === 'dim') return CALM;
    if (mode === 'game') return level === 'full' ? FULL : level === 'calm' ? CALM : STILL;
    return STILL;
  }

  function nextLevel(level) {
    const i = LEVELS.indexOf(level);
    return i === -1 ? 'calm' : LEVELS[(i + 1) % LEVELS.length];
  }

  // Pozycja klocka: pas przy lewej albo prawej krawędzi (środek zostaje dla okienka).
  function sideX(width, rand) {
    const x = width * (0.03 + rand() * 0.2);
    return rand() < 0.5 ? x : width - x;
  }

  // Litery tytułu: kolejne kolory klocków i opóźnienia „spadania”.
  function titleLetters(text) {
    let i = 0;
    return [...text].map((ch) => {
      if (ch === ' ') return { ch, space: true };
      const letter = { ch, color: COLORS[i % COLORS.length], delay: i * LETTER_DELAY_MS };
      i++;
      return letter;
    });
  }

  function createSpace({ canvas, titleEl }) {
    const ctx = canvas.getContext('2d');
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let width = 0;
    let height = 0;
    let stars = [];
    let pieces = [];
    let meteor = null;
    let nextMeteor = 0;
    let nextPiece = 0;
    let profile = null;
    let frame = null;
    let last = 0;
    const pointer = { x: 0, y: 0, tx: 0, ty: 0 };

    buildTitle();

    function buildTitle() {
      if (!titleEl) return;
      const words = titleEl.textContent.trim().split(/\s+/);
      titleEl.setAttribute('aria-label', words.join(' '));
      titleEl.textContent = '';
      let letters = titleLetters(words.join(' '));
      words.forEach((word, w) => {
        const wordEl = document.createElement('span');
        wordEl.className = 'scene-title__word';
        wordEl.setAttribute('aria-hidden', 'true');
        letters.slice(0, word.length).forEach((letter) => {
          const el = document.createElement('span');
          el.className = 'scene-title__letter';
          el.textContent = letter.ch;
          el.style.color = letter.color;
          el.style.setProperty('--d', `${letter.delay}ms`);
          wordEl.appendChild(el);
        });
        letters = letters.slice(word.length + (w < words.length - 1 ? 1 : 0));
        titleEl.appendChild(wordEl);
      });
    }

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.round(Math.min(160, (width * height) / 9000));
      stars = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height * 0.75,
        r: 0.5 + Math.random() * 1.3,
        phase: Math.random() * Math.PI * 2,
        speed: 0.6 + Math.random() * 1.6,
        depth: 0.2 + Math.random() * 0.8,
        tint: Math.random() < 0.25 ? '#b3a3e6' : '#ffffff',
      }));
      if (!running()) draw(performance.now());
    }

    function spawnPiece(now) {
      const type = Math.floor(Math.random() * SHAPES.length);
      pieces.push({
        type,
        x: sideX(width, Math.random),
        y: -60,
        angle: Math.random() * Math.PI * 2,
        spin: (Math.random() - 0.5) * 0.6,
        vy: 14 + Math.random() * 16,
        drift: (Math.random() - 0.5) * 8,
        size: 12 + Math.random() * 10,
        depth: 0.4 + Math.random() * 0.6,
      });
      nextPiece = now + profile.pieceGap[0] + Math.random() * profile.pieceGap[1];
    }

    function spawnMeteor(now) {
      meteor = {
        x: width * (0.1 + Math.random() * 0.55),
        y: height * (0.04 + Math.random() * 0.2),
        vx: 620 + Math.random() * 260,
        vy: 260 + Math.random() * 120,
        life: 0,
        ttl: 0.9,
      };
      nextMeteor = now + profile.meteorGap[0] + Math.random() * profile.meteorGap[1];
    }

    // Klocek z wypukłą krawędzią, jak na grafice.
    function drawBlock(x, y, s, color) {
      const r = s * 0.18;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect(x, y, s, s, r);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.28)';
      ctx.beginPath();
      ctx.roundRect(x + s * 0.12, y + s * 0.1, s * 0.76, s * 0.22, r * 0.6);
      ctx.fill();
      ctx.fillStyle = 'rgba(10,16,48,0.22)';
      ctx.beginPath();
      ctx.roundRect(x, y + s * 0.78, s, s * 0.22, [0, 0, r, r]);
      ctx.fill();
    }

    function drawPiece(p, ox, oy) {
      const cells = SHAPES[p.type];
      const w = Math.max(...cells.map(([c]) => c)) + 1;
      const h = Math.max(...cells.map(([, r]) => r)) + 1;
      const gap = p.size * 0.08;
      const fade = Math.min(1, Math.max(0, (height * 0.72 - p.y) / (height * 0.15)));
      ctx.save();
      ctx.globalAlpha = (profile && profile.pieceAlpha ? profile.pieceAlpha : 0.9) * fade;
      ctx.translate(p.x + ox * p.depth, p.y + oy * p.depth);
      ctx.rotate(p.angle);
      ctx.translate((-w * p.size) / 2, (-h * p.size) / 2);
      cells.forEach(([c, r]) => drawBlock(c * p.size + gap / 2, r * p.size + gap / 2, p.size - gap, COLORS[p.type]));
      ctx.restore();
    }

    function draw(t) {
      ctx.clearRect(0, 0, width, height);
      const ox = pointer.x * 14;
      const oy = pointer.y * 10;
      stars.forEach((s) => {
        const twinkle = reduced ? 0.8 : 0.45 + 0.55 * Math.abs(Math.sin(s.phase + (t / 1000) * s.speed));
        ctx.globalAlpha = twinkle;
        ctx.fillStyle = s.tint;
        ctx.beginPath();
        ctx.arc(s.x + ox * s.depth, s.y + oy * s.depth, s.r, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;
      pieces.forEach((p) => drawPiece(p, ox, oy));
      if (meteor) {
        const k = meteor.life / meteor.ttl;
        const tail = 110;
        const len = Math.hypot(meteor.vx, meteor.vy);
        const tx = meteor.x - (meteor.vx / len) * tail;
        const ty = meteor.y - (meteor.vy / len) * tail;
        const gradient = ctx.createLinearGradient(meteor.x, meteor.y, tx, ty);
        gradient.addColorStop(0, `rgba(255,255,255,${0.95 * (1 - k)})`);
        gradient.addColorStop(1, 'rgba(179,163,230,0)');
        ctx.strokeStyle = gradient;
        ctx.lineWidth = 2.2;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(meteor.x, meteor.y);
        ctx.lineTo(tx, ty);
        ctx.stroke();
      }
    }

    function step(now) {
      const dt = Math.min(0.05, (now - (last || now)) / 1000);
      last = now;
      const tx = profile.parallax ? pointer.tx : 0;
      const ty = profile.parallax ? pointer.ty : 0;
      pointer.x += (tx - pointer.x) * 0.05;
      pointer.y += (ty - pointer.y) * 0.05;
      // Na wąskim ekranie boki są zajęte przez okienko — wtedy bez klocków.
      if (now >= nextPiece && pieces.length < profile.maxPieces && width >= 640) spawnPiece(now);
      pieces.forEach((p) => {
        p.y += p.vy * dt;
        p.x += p.drift * dt;
        p.angle += p.spin * dt;
      });
      pieces = pieces.filter((p) => p.y < height * 0.75);
      if (!meteor && now >= nextMeteor) spawnMeteor(now);
      if (meteor) {
        meteor.life += dt;
        meteor.x += meteor.vx * dt;
        meteor.y += meteor.vy * dt;
        if (meteor.life >= meteor.ttl) meteor = null;
      }
      draw(now);
      frame = requestAnimationFrame(step);
    }

    function running() {
      return profile !== null && profile.animate && !reduced && !document.hidden;
    }

    function sync() {
      if (running() && frame === null) {
        last = 0;
        const now = performance.now();
        nextMeteor = Math.min(nextMeteor || Infinity, now + 2500);
        frame = requestAnimationFrame(step);
      } else if (!running() && frame !== null) {
        cancelAnimationFrame(frame);
        frame = null;
      }
    }

    function setMode(mode, level) {
      const next = profileFor(mode, level);
      if (next === profile) return;
      profile = next;
      // Mniej klocków w spokojniejszym trybie — nadmiarowe znikają.
      if (profile) pieces = pieces.slice(0, profile.maxPieces || 0);
      sync();
      if (profile && !running()) draw(performance.now());
    }

    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', sync);
    window.addEventListener('pointermove', (event) => {
      pointer.tx = (event.clientX / width) * 2 - 1;
      pointer.ty = (event.clientY / height) * 2 - 1;
    });
    resize();

    return { setMode };
  }

  Object.assign(exports, { sideX, titleLetters, profileFor, nextLevel, createSpace });
})(typeof module !== 'undefined' ? module.exports : window.Tetris);

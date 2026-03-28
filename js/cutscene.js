/**
 * cutscene.js — Full-Screen Cutscene System
 *
 * Plays a dramatic full-screen animation whenever a rare rank is rolled.
 * Phases per cutscene: fade-in → suspense (???) → flash → reveal → effects → fade-out.
 *
 * Public API (window globals):
 *   queueCutscenes(ranksArray)   – enqueue one or more rare rolls
 *   isCutsceneSystemReady()      – true after initCutsceneSystem() runs
 */

// ---------------------------------------------------------------------------
// Per-rank configuration
// ---------------------------------------------------------------------------
const CUTSCENE_CONFIG = {
  'Immortal': {
    level:       1,
    fadeInMs:    300,
    suspenseMs:  700,
    flashMs:     250,
    revealMs:    350,
    effectsMs:   1600,
    fadeOutMs:   300,
    color:       '#FFD700',
    bgColor:     '#100d00',
    particleCount:  25,
    particleColors: ['#FFD700', '#FFA000', '#FFEC00'],
    soundType:   'chime',
    shake:       false,
    subtitle:    'You have achieved immortality.',
  },
  'Eternal': {
    level:       2,
    fadeInMs:    350,
    suspenseMs:  950,
    flashMs:     300,
    revealMs:    450,
    effectsMs:   2200,
    fadeOutMs:   350,
    color:       '#00E5FF',
    bgColor:     '#001215',
    particleCount:  38,
    particleColors: ['#00E5FF', '#00BCD4', '#80DEEA', '#FFFFFF'],
    soundType:   'ethereal',
    shake:       false,
    subtitle:    'Beyond the boundary of time.',
  },
  'Celestial': {
    level:       3,
    fadeInMs:    400,
    suspenseMs:  1100,
    flashMs:     350,
    revealMs:    550,
    effectsMs:   3100,
    fadeOutMs:   400,
    color:       '#FFFFFF',
    bgColor:     '#08081a',
    particleCount:  52,
    particleColors: ['#FFFFFF', '#E0E0FF', '#B0B8FF', '#FFD700'],
    soundType:   'celestial',
    shake:       false,
    subtitle:    'A being of pure starlight.',
  },
  'Transcendent': {
    level:       4,
    fadeInMs:    450,
    suspenseMs:  1300,
    flashMs:     400,
    revealMs:    650,
    effectsMs:   4100,
    fadeOutMs:   500,
    color:       '#7C4DFF',
    bgColor:     '#0a0520',
    particleCount:  68,
    particleColors: ['#7C4DFF', '#CE93D8', '#B388FF', '#E040FB'],
    soundType:   'mystical',
    shake:       false,
    subtitle:    'Beyond all mortal comprehension.',
  },
  'Ruler': {
    level:       5,
    fadeInMs:    500,
    suspenseMs:  1500,
    flashMs:     500,
    revealMs:    750,
    effectsMs:   5200,
    fadeOutMs:   550,
    color:       '#C6A700',
    bgColor:     '#100a00',
    particleCount:  82,
    particleColors: ['#C6A700', '#FFD700', '#FFC107', '#FF8F00'],
    soundType:   'fanfare',
    shake:       false,
    subtitle:    'Supreme dominion over all things.',
  },
  'Overlord': {
    level:       6,
    fadeInMs:    600,
    suspenseMs:  1700,
    flashMs:     600,
    revealMs:    850,
    effectsMs:   6600,
    fadeOutMs:   650,
    color:       '#FF1744',
    bgColor:     '#150000',
    particleCount:  102,
    particleColors: ['#FF1744', '#FF6D00', '#FF4081', '#FF5252'],
    soundType:   'power',
    shake:       false,
    subtitle:    'None can stand before you.',
  },
  'Cosmic': {
    level:       7,
    fadeInMs:    700,
    suspenseMs:  2000,
    flashMs:     700,
    revealMs:    1000,
    effectsMs:   8000,
    fadeOutMs:   750,
    color:       '#ff6600',
    bgColor:     '#08001a',
    particleCount:  122,
    particleColors: ['#ff6600', '#9900ff', '#00ccff', '#ff00cc', '#FFFFFF'],
    soundType:   'cosmic',
    shake:       false,
    subtitle:    'Born from the fabric of the universe.',
  },
  'Infinity': {
    level:       8,
    fadeInMs:    800,
    suspenseMs:  2400,
    flashMs:     900,
    revealMs:    1200,
    effectsMs:   9700,
    fadeOutMs:   1000,
    color:       '#ff0000',
    bgColor:     '#000000',
    particleCount:  155,
    particleColors: ['#ff0000', '#ff8800', '#ffee00', '#00cc00', '#0088ff', '#8800ff'],
    soundType:   'infinite',
    shake:       true,
    subtitle:    'Boundless. Endless. Infinite.',
  },
  'Singularity': {
    level:       9,
    fadeInMs:    900,
    suspenseMs:  2900,
    flashMs:     1100,
    revealMs:    1450,
    effectsMs:   12000,
    fadeOutMs:   1200,
    color:       '#aaaaaa',
    bgColor:     '#000000',
    particleCount:  185,
    particleColors: ['#ffffff', '#888888', '#444444', '#aaaaff'],
    soundType:   'void',
    shake:       true,
    subtitle:    'A point where all existence collapses.',
  },
  'Reality Breaker': {
    level:       10,
    fadeInMs:    1000,
    suspenseMs:  3500,
    flashMs:     1400,
    revealMs:    1800,
    effectsMs:   15000,
    fadeOutMs:   1500,
    color:       '#ff0044',
    bgColor:     '#000000',
    particleCount:  225,
    particleColors: ['#ff0044', '#00ffff', '#ffff00', '#ff00ff', '#ffffff', '#ff8800'],
    soundType:   'reality',
    shake:       true,
    subtitle:    'Reality itself cannot contain you.',
  },
};

// ---------------------------------------------------------------------------
// Audio — Web Audio API synthesized sounds
// ---------------------------------------------------------------------------
let _audioCtx = null;

function _getAudioCtx() {
  if (!_audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) _audioCtx = new AC();
  }
  return _audioCtx;
}

/** Create a gain node with an envelope. Returns the gain node. */
function _makeEnvelope(ctx, peakGain, attackS, decayS, sustainGain, releaseS, startTime) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, startTime);
  g.gain.linearRampToValueAtTime(peakGain, startTime + attackS);
  g.gain.linearRampToValueAtTime(sustainGain, startTime + attackS + decayS);
  g.gain.setValueAtTime(sustainGain, startTime + attackS + decayS);
  g.gain.linearRampToValueAtTime(0, startTime + attackS + decayS + releaseS);
  return g;
}

/** Play a single tone burst. */
function _tone(ctx, freq, type, start, duration, peak, dest) {
  const osc = ctx.createOscillator();
  const env = _makeEnvelope(ctx, peak, 0.01, 0.05, peak * 0.6, duration - 0.06, start);
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  osc.connect(env);
  env.connect(dest);
  osc.start(start);
  osc.stop(start + duration);
}

/** Play a frequency sweep (glide from freq1 → freq2). */
function _sweep(ctx, freq1, freq2, type, start, duration, peak, dest) {
  const osc = ctx.createOscillator();
  const env = _makeEnvelope(ctx, peak, 0.02, 0.05, peak * 0.5, duration - 0.07, start);
  osc.type = type;
  osc.frequency.setValueAtTime(freq1, start);
  osc.frequency.exponentialRampToValueAtTime(freq2, start + duration);
  osc.connect(env);
  env.connect(dest);
  osc.start(start);
  osc.stop(start + duration);
}

/** White noise burst. */
function _noise(ctx, start, duration, peak, dest) {
  const bufSize = ctx.sampleRate * duration;
  const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
  const source = ctx.createBufferSource();
  source.buffer = buf;
  const env = _makeEnvelope(ctx, peak, 0.01, 0.05, peak * 0.4, duration - 0.06, start);
  source.connect(env);
  env.connect(dest);
  source.start(start);
  source.stop(start + duration);
}

/** Master gain / compressor for a single sound effect. */
function _masterOut(ctx, volume) {
  const compressor = ctx.createDynamicsCompressor();
  compressor.threshold.value = -18;
  compressor.knee.value = 12;
  compressor.ratio.value = 4;
  compressor.attack.value = 0.003;
  compressor.release.value = 0.25;
  const gain = ctx.createGain();
  gain.gain.value = volume;
  compressor.connect(gain);
  gain.connect(ctx.destination);
  return compressor;
}

function _playSound(type, level) {
  if (typeof isSoundEnabled === 'function' && !isSoundEnabled()) return;
  const ctx = _getAudioCtx();
  if (!ctx) return;
  try {
    if (ctx.state === 'suspended') ctx.resume();
    const t = ctx.currentTime + 0.05;
    const out = _masterOut(ctx, 0.35);

    switch (type) {
      case 'chime': {
        // Soft chime trio
        _tone(ctx, 1047, 'sine', t,       0.6, 0.6, out); // C6
        _tone(ctx, 1319, 'sine', t + 0.1, 0.5, 0.5, out); // E6
        _tone(ctx, 1568, 'sine', t + 0.2, 0.4, 0.4, out); // G6
        break;
      }
      case 'ethereal': {
        // Flowing pad-like waves
        _tone(ctx, 440,  'sine', t,       2.0, 0.5, out);
        _tone(ctx, 554,  'sine', t + 0.3, 1.5, 0.3, out);
        _tone(ctx, 659,  'sine', t + 0.6, 1.2, 0.25, out);
        _sweep(ctx, 440, 550, 'sine', t, 2.0, 0.2, out);
        break;
      }
      case 'celestial': {
        // Angelic chord with bell harmonics
        const chord = [523, 659, 784, 1047]; // C5, E5, G5, C6
        chord.forEach((f, i) => _tone(ctx, f, 'sine', t + i * 0.12, 2.5, 0.4, out));
        _tone(ctx, 2093, 'sine', t + 0.4, 1.5, 0.15, out); // C7 bell
        break;
      }
      case 'mystical': {
        // Deep drone with overtones
        _tone(ctx, 110, 'sawtooth', t, 3.0, 0.3, out);
        _tone(ctx, 220, 'sine',     t, 3.0, 0.2, out);
        _tone(ctx, 330, 'sine',     t + 0.5, 2.0, 0.15, out);
        _sweep(ctx, 660, 880, 'sine', t + 1.0, 1.5, 0.2, out);
        break;
      }
      case 'fanfare': {
        // Triumphant rising arpeggio
        const notes = [261, 329, 392, 523, 659, 784, 1047];
        notes.forEach((f, i) => _tone(ctx, f, 'square', t + i * 0.12, 0.45, 0.35, out));
        _tone(ctx, 1047, 'sine', t + notes.length * 0.12, 1.0, 0.4, out);
        break;
      }
      case 'power': {
        // Deep bass impact + whoosh
        _tone(ctx, 55,  'sine',     t,       0.8, 0.7, out);
        _tone(ctx, 110, 'sawtooth', t,       0.6, 0.4, out);
        _sweep(ctx, 880, 55, 'sawtooth', t + 0.1, 1.2, 0.5, out);
        _noise(ctx, t, 0.4, 0.3, out);
        break;
      }
      case 'cosmic': {
        // Space sweep — multiple voices gliding
        _sweep(ctx, 1760, 110, 'sine',     t,       3.0, 0.35, out);
        _sweep(ctx, 880,  220, 'sine',     t + 0.5, 2.5, 0.25, out);
        _sweep(ctx, 440,  55,  'sawtooth', t + 1.0, 2.0, 0.2,  out);
        _noise(ctx, t, 2.0, 0.15, out);
        break;
      }
      case 'infinite': {
        // Endless rising arpeggio cycling through all 12 semitones
        const base = 65.4; // C2
        for (let i = 0; i < 12; i++) {
          const f = base * Math.pow(2, i / 12) * 4;
          _tone(ctx, f, 'sine', t + i * 0.2, 0.6, 0.3, out);
        }
        _sweep(ctx, 55, 3520, 'sawtooth', t, 4.0, 0.2, out);
        _noise(ctx, t + 2.0, 1.5, 0.2, out);
        break;
      }
      case 'void': {
        // Imploding whoosh — sweeps from high to subsonic + rumble
        _sweep(ctx, 3520, 20, 'sawtooth', t, 4.0, 0.5, out);
        _sweep(ctx, 1760, 30, 'sine',     t + 0.5, 3.5, 0.4, out);
        _noise(ctx, t, 5.0, 0.35, out);
        _tone(ctx, 30, 'sine', t + 2.0, 3.0, 0.6, out);
        break;
      }
      case 'reality': {
        // Chaotic glitch: random bursts + bass drops + noise layers
        _noise(ctx, t, 2.0, 0.5, out);
        _sweep(ctx, 7040, 27.5, 'sawtooth', t, 3.0, 0.5, out);
        _sweep(ctx, 3520, 55,   'square',   t + 0.3, 2.5, 0.4, out);
        for (let i = 0; i < 6; i++) {
          const f = 110 * Math.pow(2, Math.random() * 4);
          _tone(ctx, f, 'sawtooth', t + i * 0.4, 0.35, 0.45, out);
        }
        _tone(ctx, 27.5, 'sine', t + 1.5, 4.0, 0.7, out);
        _noise(ctx, t + 2.5, 2.0, 0.4, out);
        break;
      }
    }
  } catch (e) {
    // Audio errors must never break gameplay
  }
}

// ---------------------------------------------------------------------------
// Canvas particle system
// ---------------------------------------------------------------------------
let _canvas = null;
let _canvasCtx = null;
let _particles = [];
let _animFrameId = null;
let _particlePhase = 'idle'; // 'suspense' | 'burst' | 'drift' | 'idle'
let _currentCfg = null;

function _setupCanvas() {
  _canvas = document.getElementById('cutscene-canvas');
  if (!_canvas) return;
  _canvasCtx = _canvas.getContext('2d');
  _resizeCanvas();
  window.addEventListener('resize', _resizeCanvas);
}

function _resizeCanvas() {
  if (!_canvas) return;
  _canvas.width = window.innerWidth;
  _canvas.height = window.innerHeight;
}

function _randomColor(colors) {
  return colors[Math.floor(Math.random() * colors.length)];
}

/** Spawn slow-drifting suspense particles. */
function _spawnSuspenseParticles(cfg) {
  const count = Math.floor(cfg.particleCount * 0.3);
  const cx = _canvas.width / 2;
  const cy = _canvas.height / 2;
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const r = 80 + Math.random() * Math.min(_canvas.width, _canvas.height) * 0.3;
    _particles.push({
      x: cx + Math.cos(angle) * r,
      y: cy + Math.sin(angle) * r,
      vx: (Math.random() - 0.5) * 0.6,
      vy: (Math.random() - 0.5) * 0.6,
      size: 2 + Math.random() * 4,
      color: _randomColor(cfg.particleColors),
      opacity: 0.3 + Math.random() * 0.5,
      life: 1,
      decay: 0.002 + Math.random() * 0.003,
      type: 'drift',
    });
  }
}

/** Burst of particles exploding from centre on reveal. */
function _spawnBurstParticles(cfg) {
  const cx = _canvas.width / 2;
  const cy = _canvas.height / 2;
  for (let i = 0; i < cfg.particleCount; i++) {
    const angle = (i / cfg.particleCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
    const speed = 3 + Math.random() * 8 * (cfg.level / 10);
    const size = 2 + Math.random() * 6 * (cfg.level / 10);
    _particles.push({
      x: cx,
      y: cy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size,
      color: _randomColor(cfg.particleColors),
      opacity: 1,
      life: 1,
      decay: 0.008 + Math.random() * 0.012,
      type: 'burst',
    });
  }
  // Extra large "star" particles for higher levels
  if (cfg.level >= 6) {
    const starCount = Math.floor(cfg.level * 3);
    for (let i = 0; i < starCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1 + Math.random() * 4;
      _particles.push({
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 4 + Math.random() * 8,
        color: '#ffffff',
        opacity: 0.9,
        life: 1,
        decay: 0.004 + Math.random() * 0.006,
        type: 'star',
      });
    }
  }
}

/** Ambient drifting particles during the effects phase. */
function _spawnEffectParticles(cfg) {
  const cx = _canvas.width / 2;
  const cy = _canvas.height / 2;
  const extra = Math.floor(cfg.particleCount * 0.5);
  for (let i = 0; i < extra; i++) {
    const angle = Math.random() * Math.PI * 2;
    const r = 20 + Math.random() * Math.min(_canvas.width, _canvas.height) * 0.45;
    _particles.push({
      x: cx + Math.cos(angle) * r,
      y: cy + Math.sin(angle) * r,
      vx: (Math.random() - 0.5) * 1.2,
      vy: (Math.random() - 0.5) * 1.2 - 0.3,
      size: 1.5 + Math.random() * 4,
      color: _randomColor(cfg.particleColors),
      opacity: 0.4 + Math.random() * 0.6,
      life: 1,
      decay: 0.003 + Math.random() * 0.005,
      type: 'drift',
    });
  }
}

function _drawParticle(p) {
  _canvasCtx.save();
  _canvasCtx.globalAlpha = p.opacity * p.life;
  _canvasCtx.fillStyle = p.color;
  if (p.type === 'star' && p.size > 5) {
    // Draw a small 4-point star
    _canvasCtx.beginPath();
    const s = p.size;
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      const r = k % 2 === 0 ? s : s * 0.45;
      const x = p.x + Math.cos(a) * r;
      const y = p.y + Math.sin(a) * r;
      k === 0 ? _canvasCtx.moveTo(x, y) : _canvasCtx.lineTo(x, y);
    }
    _canvasCtx.closePath();
    _canvasCtx.fill();
  } else {
    _canvasCtx.beginPath();
    _canvasCtx.arc(p.x, p.y, p.size / 2, 0, Math.PI * 2);
    _canvasCtx.fill();
  }
  _canvasCtx.restore();
}

/** For Singularity: draw swirling vortex particles. */
function _applyVortex(p, cx, cy) {
  const dx = p.x - cx;
  const dy = p.y - cy;
  const dist = Math.sqrt(dx * dx + dy * dy) || 1;
  const pull = 0.5 / dist;
  p.vx -= dx * pull * 0.02;
  p.vy -= dy * pull * 0.02;
  // Also add a tangential rotation
  p.vx += -dy / dist * 0.4;
  p.vy +=  dx / dist * 0.4;
  // Clamp velocity
  const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
  if (speed > 6) { p.vx = (p.vx / speed) * 6; p.vy = (p.vy / speed) * 6; }
}

function _tickParticles() {
  if (!_canvas || !_canvasCtx) return;
  _canvasCtx.clearRect(0, 0, _canvas.width, _canvas.height);

  const cx = _canvas.width / 2;
  const cy = _canvas.height / 2;
  const isSingularity = _currentCfg && _currentCfg.soundType === 'void';

  for (let i = _particles.length - 1; i >= 0; i--) {
    const p = _particles[i];
    if (isSingularity && _particlePhase === 'drift') _applyVortex(p, cx, cy);
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.02; // gentle gravity
    p.life -= p.decay;
    if (p.life <= 0) {
      _particles.splice(i, 1);
    } else {
      _drawParticle(p);
    }
  }

  // Continuously spawn ambient particles during effects phase
  if (_particlePhase === 'drift' && _currentCfg && _particles.length < _currentCfg.particleCount * 0.8) {
    const toSpawn = Math.min(3 + _currentCfg.level, 8);
    for (let j = 0; j < toSpawn; j++) {
      const angle = Math.random() * Math.PI * 2;
      const r = 20 + Math.random() * Math.min(_canvas.width, _canvas.height) * 0.45;
      _particles.push({
        x: cx + Math.cos(angle) * r,
        y: cy + Math.sin(angle) * r,
        vx: (Math.random() - 0.5) * 1.5,
        vy: (Math.random() - 0.5) * 1.5 - 0.2,
        size: 1.5 + Math.random() * 4,
        color: _randomColor(_currentCfg.particleColors),
        opacity: 0.5 + Math.random() * 0.5,
        life: 1,
        decay: 0.003 + Math.random() * 0.005,
        type: 'drift',
      });
    }
  }

  _animFrameId = requestAnimationFrame(_tickParticles);
}

function _startParticleLoop() {
  if (_animFrameId) cancelAnimationFrame(_animFrameId);
  _animFrameId = requestAnimationFrame(_tickParticles);
}

function _stopParticleLoop() {
  if (_animFrameId) {
    cancelAnimationFrame(_animFrameId);
    _animFrameId = null;
  }
  _particles = [];
  if (_canvasCtx && _canvas) _canvasCtx.clearRect(0, 0, _canvas.width, _canvas.height);
}

// ---------------------------------------------------------------------------
// Overlay DOM — built once, reused per cutscene
// ---------------------------------------------------------------------------
function _buildOverlayDOM() {
  const el = document.createElement('div');
  el.id = 'cutscene-overlay';
  el.innerHTML = `
    <canvas id="cutscene-canvas"></canvas>
    <div id="cutscene-bg-fx" class="cutscene-bg-fx"></div>
    <div id="cutscene-glow" class="cutscene-glow"></div>
    <div id="cutscene-content" class="cutscene-content">
      <div id="cutscene-suspense" class="cutscene-suspense">???</div>
      <div id="cutscene-reveal" class="cutscene-reveal" style="display:none">
        <div id="cutscene-emoji" class="cutscene-emoji"></div>
        <div id="cutscene-rank-name" class="cutscene-rank-name"></div>
        <div id="cutscene-rank-subtitle" class="cutscene-rank-subtitle"></div>
      </div>
    </div>
    <div id="cutscene-scanlines" class="cutscene-scanlines" style="display:none"></div>
    <button id="cutscene-skip-btn" class="cutscene-skip-btn" aria-label="Skip cutscene">SKIP ▶</button>
  `;
  document.body.appendChild(el);
  return el;
}

// Cached DOM refs
const _dom = {};
function _cacheDOMRefs() {
  _dom.overlay      = document.getElementById('cutscene-overlay');
  _dom.canvas       = document.getElementById('cutscene-canvas');
  _dom.bgFx         = document.getElementById('cutscene-bg-fx');
  _dom.glow         = document.getElementById('cutscene-glow');
  _dom.content      = document.getElementById('cutscene-content');
  _dom.suspense     = document.getElementById('cutscene-suspense');
  _dom.reveal       = document.getElementById('cutscene-reveal');
  _dom.emoji        = document.getElementById('cutscene-emoji');
  _dom.rankName     = document.getElementById('cutscene-rank-name');
  _dom.subtitle     = document.getElementById('cutscene-rank-subtitle');
  _dom.scanlines    = document.getElementById('cutscene-scanlines');
  _dom.skipBtn      = document.getElementById('cutscene-skip-btn');
}

// ---------------------------------------------------------------------------
// Screen shake for top-3 ranks (levels 8-10)
// ---------------------------------------------------------------------------
function _shakeOverlay(level) {
  const el = _dom.overlay;
  if (!el) return;
  const cls = `cutscene-shake-${level}`;
  el.classList.remove('cutscene-shake-8', 'cutscene-shake-9', 'cutscene-shake-10');
  void el.offsetWidth;
  el.classList.add(cls);
  const dur = level === 8 ? 600 : level === 9 ? 900 : 1200;
  setTimeout(() => el.classList.remove(cls), dur);
}

// ---------------------------------------------------------------------------
// Theme application
// ---------------------------------------------------------------------------
function _applyTheme(cfg) {
  const rankObj = (typeof RANKS !== 'undefined')
    ? RANKS.find((r) => r.name === _currentRankName)
    : null;

  // Background
  _dom.overlay.style.background = cfg.bgColor;
  _dom.bgFx.style.background = '';
  _dom.bgFx.style.animation = '';
  _dom.scanlines.style.display = 'none';

  // Suspense text color
  _dom.suspense.style.color = cfg.color;
  _dom.suspense.style.textShadow = `0 0 40px ${cfg.color}88, 0 0 80px ${cfg.color}44`;

  // Rank name color
  if (rankObj) {
    const specialFX = typeof SPECIAL_COLOR_FX !== 'undefined' ? SPECIAL_COLOR_FX : [];
    if (specialFX.includes(rankObj.color)) {
      _dom.rankName.className = `cutscene-rank-name fx-${rankObj.color}`;
    } else {
      _dom.rankName.className = 'cutscene-rank-name';
      _dom.rankName.style.color = cfg.color;
      _dom.rankName.style.textShadow = `0 0 40px ${cfg.color}cc, 0 0 80px ${cfg.color}66`;
    }
  } else {
    _dom.rankName.className = 'cutscene-rank-name';
    _dom.rankName.style.color = cfg.color;
    _dom.rankName.style.textShadow = `0 0 40px ${cfg.color}cc, 0 0 80px ${cfg.color}66`;
  }

  // Glow orb
  _dom.glow.style.background = `radial-gradient(circle, ${cfg.color}44 0%, ${cfg.color}11 50%, transparent 70%)`;
  _dom.glow.style.opacity = '0';

  // Special theme extras
  if (cfg.soundType === 'reality') {
    _dom.scanlines.style.display = 'block';
    _dom.bgFx.classList.add('cutscene-bg-glitch');
  } else {
    _dom.bgFx.classList.remove('cutscene-bg-glitch');
  }
  if (cfg.soundType === 'void') {
    _dom.bgFx.classList.add('cutscene-bg-void');
  } else {
    _dom.bgFx.classList.remove('cutscene-bg-void');
  }
  if (cfg.soundType === 'cosmic') {
    _dom.bgFx.classList.add('cutscene-bg-cosmic');
  } else {
    _dom.bgFx.classList.remove('cutscene-bg-cosmic');
  }
}

// ---------------------------------------------------------------------------
// Flash burst effect on reveal
// ---------------------------------------------------------------------------
function _triggerRevealFlash(cfg) {
  const flash = document.createElement('div');
  flash.className = 'cutscene-flash';
  flash.style.background = cfg.color;
  _dom.overlay.appendChild(flash);
  setTimeout(() => flash.remove(), 800);
}

// ---------------------------------------------------------------------------
// Cutscene phase sequencer
// ---------------------------------------------------------------------------
let _currentRankName = '';
let _phaseTimeouts = [];

function _clearTimeouts() {
  _phaseTimeouts.forEach(clearTimeout);
  _phaseTimeouts = [];
}

function _after(ms, fn) {
  const id = setTimeout(fn, ms);
  _phaseTimeouts.push(id);
  return id;
}

function _playSingleCutscene(rank, onDone) {
  const cfg = CUTSCENE_CONFIG[rank.name];
  if (!cfg) { onDone(); return; }

  _currentRankName = rank.name;
  _currentCfg = cfg;

  // Populate content
  _dom.emoji.textContent = rank.emoji || '';
  _dom.rankName.textContent = `${rank.emoji || ''} ${rank.name}`;
  _dom.subtitle.textContent = cfg.subtitle || '';

  // Reset state
  _dom.suspense.style.display = 'block';
  _dom.suspense.classList.remove('cutscene-suspense-pulse');
  _dom.reveal.style.display = 'none';
  _dom.reveal.classList.remove('cutscene-reveal-enter');
  _dom.subtitle.classList.remove('cutscene-subtitle-enter');
  _dom.overlay.classList.remove('cutscene-fade-out');
  _dom.glow.style.opacity = '0';
  _particles = [];

  _applyTheme(cfg);

  // Show overlay
  _dom.overlay.style.display = 'flex';
  _dom.overlay.style.opacity = '0';

  let elapsed = 0;

  // ── Phase 0: Fade in ──────────────────────────────────────────────────────
  _after(16, () => {
    _dom.overlay.style.transition = `opacity ${cfg.fadeInMs}ms ease`;
    _dom.overlay.style.opacity = '1';
  });
  elapsed += cfg.fadeInMs;

  // ── Phase 1: Suspense — "???" pulses with particles ───────────────────────
  _after(elapsed, () => {
    _particlePhase = 'suspense';
    _spawnSuspenseParticles(cfg);
    _startParticleLoop();
    _dom.suspense.classList.add('cutscene-suspense-pulse');

    // Growing glow during suspense
    _dom.glow.style.transition = `opacity ${cfg.suspenseMs}ms ease`;
    _dom.glow.style.opacity = '0.6';

    // Play sound at the start of suspense
    _playSound(cfg.soundType, cfg.level);
  });
  elapsed += cfg.suspenseMs;

  // ── Phase 2: Flash burst ──────────────────────────────────────────────────
  _after(elapsed, () => {
    _triggerRevealFlash(cfg);
    if (cfg.shake) _shakeOverlay(cfg.level);

    // Spawn burst particles
    _particlePhase = 'burst';
    _spawnBurstParticles(cfg);

    // Intense glow pulse
    _dom.glow.style.transition = `opacity ${cfg.flashMs * 0.3}ms ease`;
    _dom.glow.style.opacity = '1';
    _after(Math.floor(cfg.flashMs * 0.4), () => {
      _dom.glow.style.transition = `opacity ${cfg.flashMs * 0.6}ms ease`;
      _dom.glow.style.opacity = '0.5';
    });
  });
  elapsed += cfg.flashMs;

  // ── Phase 3: Rank reveal ──────────────────────────────────────────────────
  _after(elapsed, () => {
    _dom.suspense.style.display = 'none';
    _dom.reveal.style.display = 'flex';
    _dom.reveal.classList.add('cutscene-reveal-enter');
    _after(Math.floor(cfg.revealMs * 0.6), () => {
      _dom.subtitle.classList.add('cutscene-subtitle-enter');
    });
  });
  elapsed += cfg.revealMs;

  // ── Phase 4: Effects play ─────────────────────────────────────────────────
  _after(elapsed, () => {
    _particlePhase = 'drift';
    _spawnEffectParticles(cfg);
    // Repeat shake for top-tier ranks mid-effects
    if (cfg.shake && cfg.level >= 9) {
      _after(Math.floor(cfg.effectsMs * 0.3), () => _shakeOverlay(cfg.level));
    }
    if (cfg.shake && cfg.level >= 10) {
      _after(Math.floor(cfg.effectsMs * 0.6), () => _shakeOverlay(cfg.level));
    }
  });
  elapsed += cfg.effectsMs;

  // ── Phase 5: Fade out ─────────────────────────────────────────────────────
  _after(elapsed, () => {
    _dom.overlay.style.transition = `opacity ${cfg.fadeOutMs}ms ease`;
    _dom.overlay.style.opacity = '0';
  });
  elapsed += cfg.fadeOutMs;

  // ── Done ──────────────────────────────────────────────────────────────────
  _after(elapsed, () => {
    _teardownCutscene();
    onDone();
  });
}

function _teardownCutscene() {
  _clearTimeouts();
  _stopParticleLoop();
  _particlePhase = 'idle';
  _currentCfg = null;
  _currentRankName = '';
  _dom.overlay.style.display = 'none';
  _dom.overlay.style.opacity = '0';
  _dom.overlay.style.transition = '';
}

// ---------------------------------------------------------------------------
// Queue system
// ---------------------------------------------------------------------------
let _queue = [];
let _playing = false;
let _skipRequested = false;

function _processQueue() {
  if (_queue.length === 0) {
    _playing = false;
    if (typeof _onAllCutscenesDone === 'function') _onAllCutscenesDone();
    return;
  }
  _playing = true;
  _skipRequested = false;
  const rank = _queue.shift();
  _playSingleCutscene(rank, _processQueue);
}

/** Skip the current cutscene and advance to the next one (or end). */
function _skipCurrent() {
  if (!_playing) return;
  _skipRequested = true;
  _clearTimeouts();
  _teardownCutscene();
  _after(50, _processQueue); // small delay so DOM settles
}

// Callback invoked when all queued cutscenes have finished
let _onAllCutscenesDone = null;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Enqueue one or more ranks for cutscene playback.
 * @param {object[]} ranks       – array of rank objects (from RANKS)
 * @param {Function} [onDone]    – optional callback when queue empties
 */
function queueCutscenes(ranks, onDone) {
  if (!Array.isArray(ranks) || ranks.length === 0) {
    if (typeof onDone === 'function') onDone();
    return;
  }
  // Filter to only ranks that have a config and are settings-enabled
  const valid = ranks.filter((r) => {
    if (!CUTSCENE_CONFIG[r.name]) return false;
    if (typeof isCutsceneEnabled === 'function' && !isCutsceneEnabled(r.name)) return false;
    return true;
  });
  if (valid.length === 0) {
    if (typeof onDone === 'function') onDone();
    return;
  }
  _onAllCutscenesDone = typeof onDone === 'function' ? onDone : null;
  _queue.push(...valid);
  if (!_playing) _processQueue();
}

function isCutsceneSystemReady() { return !!_dom.overlay; }

// ---------------------------------------------------------------------------
// Initialise — called from game.js DOMContentLoaded
// ---------------------------------------------------------------------------
function initCutsceneSystem() {
  _buildOverlayDOM();
  _cacheDOMRefs();
  _setupCanvas();

  // Skip button
  if (_dom.skipBtn) {
    _dom.skipBtn.addEventListener('click', _skipCurrent);
  }
}

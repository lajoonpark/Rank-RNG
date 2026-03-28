/**
 * cutscene.js — Full-Screen Cutscene System
 *
 * Plays a dramatic full-screen animation whenever a rare rank is rolled.
 * Phases per cutscene: fade-in → suspense (???) → flash → reveal → effects → fade-out.
 *
 * Public API (window globals):
 *   queueCutscenes(ranksArray)   – enqueue one or more rare rolls
 *   isCutsceneSystemReady()      – true after initCutsceneSystem() runs
 *   isCutscenesPlaying()         – true while a cutscene is currently playing
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
    revealMs:    900,
    effectsMs:   6600,
    fadeOutMs:   650,
    color:       '#FF1744',
    bgColor:     '#000000',
    particleCount:  102,
    particleColors: ['#FF1744', '#FF6D00', '#FF4081', '#FF5252'],
    soundType:   'overlord',
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
      case 'overlord': {
        // Deep sub-bass drone — commanding and ominous, power building slowly
        _tone(ctx, 41.2,  'sine',     t,       5.0, 0.55, out); // E1 sub-bass
        _tone(ctx, 82.4,  'sine',     t + 0.4, 4.5, 0.35, out); // E2 drone
        _tone(ctx, 123.5, 'triangle', t + 0.8, 4.0, 0.20, out); // B2 fifth
        _sweep(ctx, 246.9, 123.5, 'sawtooth', t + 0.5, 3.5, 0.25, out); // B3→B2 descend
        _tone(ctx, 1318.5, 'sine',   t + 2.0, 2.5, 0.08, out); // E6 high eerie harmonic
        _sweep(ctx, 1318.5, 659.3, 'sine', t + 2.0, 2.5, 0.07, out); // E6→E5 glide down
        _noise(ctx, t, 0.8, 0.18, out);
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
let _customCanvasDraw = null; // optional per-frame draw fn set by special cutscenes

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

  if (typeof _customCanvasDraw === 'function') _customCanvasDraw(_canvasCtx, _canvas);
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
let _pendingCleanup = null; // cleanup fn registered by special cutscenes

function _clearTimeouts() {
  _phaseTimeouts.forEach(clearTimeout);
  _phaseTimeouts = [];
}

function _after(ms, fn) {
  const id = setTimeout(fn, ms);
  _phaseTimeouts.push(id);
  return id;
}

// ---------------------------------------------------------------------------
// Overlord special cutscene — unique cinematic sequence
// ---------------------------------------------------------------------------
function _playOverlordCutscene(rank, onDone) {
  const cfg = CUTSCENE_CONFIG[rank.name];
  if (!cfg) { onDone(); return; }

  _currentRankName = rank.name;
  _currentCfg = cfg;

  // Populate reveal content
  _dom.rankName.textContent = `${rank.emoji || ''} ${rank.name}`;
  _dom.subtitle.textContent = cfg.subtitle || '';

  // Reset standard DOM elements
  _dom.suspense.style.display = 'none';
  _dom.reveal.style.display = 'none';
  _dom.reveal.classList.remove('cutscene-reveal-enter');
  _dom.subtitle.classList.remove('cutscene-subtitle-enter');
  _dom.overlay.classList.remove('cutscene-fade-out');
  _dom.glow.style.opacity = '0';
  _dom.glow.style.transition = '';
  _dom.bgFx.style.background = '';
  _dom.bgFx.style.animation = '';
  _dom.bgFx.classList.remove('cutscene-bg-glitch', 'cutscene-bg-void', 'cutscene-bg-cosmic');
  _dom.scanlines.style.display = 'none';
  _particles = [];

  // Black background; rank name styled in Overlord colour
  _dom.overlay.style.background = '#000000';
  _dom.rankName.className = 'cutscene-rank-name';
  _dom.rankName.style.color = cfg.color;
  _dom.rankName.style.textShadow = `0 0 40px ${cfg.color}cc, 0 0 80px ${cfg.color}66`;
  _dom.glow.style.background =
    `radial-gradient(circle, ${cfg.color}44 0%, ${cfg.color}11 50%, transparent 70%)`;

  // ── Build Overlord-specific DOM elements ──────────────────────────────────

  const introText = document.createElement('div');
  introText.className = 'overlord-intro-text';
  introText.textContent = '"your wish is my command..."';
  _dom.overlay.appendChild(introText);

  const diamondWrap = document.createElement('div');
  diamondWrap.className = 'overlord-diamond-wrap';
  const diamond = document.createElement('div');
  diamond.className = 'overlord-diamond';
  diamondWrap.appendChild(diamond);
  _dom.overlay.appendChild(diamondWrap);

  const whiteout = document.createElement('div');
  whiteout.className = 'overlord-whiteout';
  _dom.overlay.appendChild(whiteout);

  function _cleanup() {
    introText.remove();
    diamondWrap.remove();
    whiteout.remove();
  }
  _pendingCleanup = _cleanup;

  // Show overlay — already on a black background, no fade-in needed
  _dom.overlay.style.display = 'flex';
  _dom.overlay.style.opacity = '1';
  _dom.overlay.style.transition = '';

  let elapsed = 0;

  // Timing constants (ms)
  const TEXT_FADE_IN  = 1400;
  const TEXT_HOLD     = 1800;
  const TEXT_FADE_OUT = 1000;
  const TEXT_GAP      =  200;

  const DIAMOND_APPEAR = 700;
  const DIAMOND_RAMP1  = 1600;
  const DIAMOND_RAMP2  = 1400;
  const DIAMOND_SURGE  =  600;

  const WHITEOUT_IN   =  500;
  const WHITEOUT_HOLD =  300;
  const WHITEOUT_OUT  =  700;
  const WHITEOUT_GAP  =  200;

  // ── Phase 1: Text fades in (letters converge) ─────────────────────────────
  _after(80, () => {
    introText.style.transition =
      `opacity ${TEXT_FADE_IN}ms ease, letter-spacing ${TEXT_FADE_IN}ms ease`;
    introText.style.opacity = '1';
    introText.style.letterSpacing = '4px';
  });
  elapsed += TEXT_FADE_IN + TEXT_HOLD;

  // ── Phase 1b: Text fades out ──────────────────────────────────────────────
  _after(elapsed, () => {
    introText.style.transition = `opacity ${TEXT_FADE_OUT}ms ease`;
    introText.style.opacity = '0';
  });
  elapsed += TEXT_FADE_OUT + TEXT_GAP;

  // ── Phase 2a: Diamond fades in (dim) ─────────────────────────────────────
  _after(elapsed, () => {
    diamondWrap.style.transition = `opacity ${DIAMOND_APPEAR}ms ease`;
    diamondWrap.style.opacity = '1';
    _playSound(cfg.soundType, cfg.level);
  });
  elapsed += DIAMOND_APPEAR;

  // ── Phase 2b: Diamond brightness ramp — slow first pass ──────────────────
  _after(elapsed, () => {
    diamond.style.transition =
      `filter ${DIAMOND_RAMP1}ms ease, box-shadow ${DIAMOND_RAMP1}ms ease`;
    diamond.style.filter = 'brightness(1.0) saturate(1.1)';
    diamond.style.boxShadow = [
      '0 0 30px rgba(255,23,68,0.6)',
      '0 0 60px rgba(255,23,68,0.3)',
      '0 0 100px rgba(255,23,68,0.15)',
    ].join(',');
    _dom.glow.style.transition = `opacity ${DIAMOND_RAMP1}ms ease`;
    _dom.glow.style.opacity = '0.35';
  });
  elapsed += DIAMOND_RAMP1;

  // ── Phase 2c: Medium intensity ───────────────────────────────────────────
  _after(elapsed, () => {
    diamond.style.transition =
      `filter ${DIAMOND_RAMP2}ms ease, box-shadow ${DIAMOND_RAMP2}ms ease`;
    diamond.style.filter = 'brightness(2.5) saturate(1.4)';
    diamond.style.boxShadow = [
      '0 0 60px rgba(255,23,68,0.9)',
      '0 0 120px rgba(255,23,68,0.5)',
      '0 0 200px rgba(255,23,68,0.25)',
    ].join(',');
    _dom.glow.style.transition = `opacity ${DIAMOND_RAMP2}ms ease`;
    _dom.glow.style.opacity = '0.65';
  });
  elapsed += DIAMOND_RAMP2;

  // ── Phase 2d: Surge to peak brightness ───────────────────────────────────
  _after(elapsed, () => {
    diamond.style.transition =
      `filter ${DIAMOND_SURGE}ms ease, box-shadow ${DIAMOND_SURGE}ms ease`;
    diamond.style.filter = 'brightness(6.0) saturate(1.8) blur(2px)';
    diamond.style.boxShadow = [
      '0 0 120px rgba(255,23,68,1)',
      '0 0 250px rgba(255,100,80,0.8)',
      '0 0 400px rgba(255,150,100,0.5)',
    ].join(',');
    _dom.glow.style.transition = `opacity ${DIAMOND_SURGE}ms ease`;
    _dom.glow.style.opacity = '1';
  });
  elapsed += DIAMOND_SURGE;

  // ── Phase 3: Whiteout — screen overwhelmed by light ──────────────────────
  _after(elapsed, () => {
    whiteout.style.transition = `opacity ${WHITEOUT_IN}ms ease-in`;
    whiteout.style.opacity = '1';
  });
  elapsed += WHITEOUT_IN + WHITEOUT_HOLD;

  // ── Phase 3b: Whiteout fades out, revealing black + rank reveal ──────────
  _after(elapsed, () => {
    diamondWrap.style.transition = '';
    diamondWrap.style.opacity = '0';
    // Glow fades out at half the whiteout-out duration so it clears before the reveal
    _dom.glow.style.transition = `opacity ${Math.floor(WHITEOUT_OUT * 0.5)}ms ease`;
    _dom.glow.style.opacity = '0';
    whiteout.style.transition = `opacity ${WHITEOUT_OUT}ms ease-out`;
    whiteout.style.opacity = '0';
  });
  elapsed += WHITEOUT_OUT + WHITEOUT_GAP;

  // ── Phase 4: Rank reveal ──────────────────────────────────────────────────
  _after(elapsed, () => {
    _dom.reveal.style.display = 'flex';
    _dom.reveal.classList.add('cutscene-reveal-enter');
    _particlePhase = 'burst';
    _spawnBurstParticles(cfg);
    _startParticleLoop();
    _dom.glow.style.transition = `opacity ${cfg.revealMs}ms ease`;
    _dom.glow.style.opacity = '0.7';
    // Subtitle enters slightly after the rank name to create a staggered reveal effect
    _after(Math.floor(cfg.revealMs * 0.6), () => {
      _dom.subtitle.classList.add('cutscene-subtitle-enter');
    });
  });
  elapsed += cfg.revealMs;

  // ── Phase 5: Effects ──────────────────────────────────────────────────────
  _after(elapsed, () => {
    _particlePhase = 'drift';
    _spawnEffectParticles(cfg);
  });
  elapsed += cfg.effectsMs;

  // ── Phase 6: Fade out ─────────────────────────────────────────────────────
  _after(elapsed, () => {
    _dom.overlay.style.transition = `opacity ${cfg.fadeOutMs}ms ease`;
    _dom.overlay.style.opacity = '0';
  });
  elapsed += cfg.fadeOutMs;

  // ── Done ──────────────────────────────────────────────────────────────────
  _after(elapsed, () => {
    _teardownCutscene(); // also calls _pendingCleanup → _cleanup
    onDone();
  });
}

// ---------------------------------------------------------------------------
// Shared helper — standard DOM/state reset used by all special cutscenes
// ---------------------------------------------------------------------------
function _resetSpecialCutsceneDOM(cfg) {
  _dom.suspense.style.display = 'none';
  _dom.reveal.style.display = 'none';
  _dom.reveal.classList.remove('cutscene-reveal-enter');
  _dom.subtitle.classList.remove('cutscene-subtitle-enter');
  _dom.overlay.classList.remove('cutscene-fade-out');
  _dom.glow.style.opacity = '0';
  _dom.glow.style.transition = '';
  _dom.bgFx.style.background = '';
  _dom.bgFx.style.animation = '';
  _dom.bgFx.classList.remove('cutscene-bg-glitch', 'cutscene-bg-void', 'cutscene-bg-cosmic');
  _dom.scanlines.style.display = 'none';
  _particles = [];

  _dom.overlay.style.background = '#000000';
  _dom.rankName.className = 'cutscene-rank-name';
  _dom.rankName.style.color = cfg.color;
  _dom.rankName.style.textShadow = `0 0 40px ${cfg.color}cc, 0 0 80px ${cfg.color}66`;
  _dom.glow.style.background =
    `radial-gradient(circle, ${cfg.color}44 0%, ${cfg.color}11 50%, transparent 70%)`;

  _dom.overlay.style.display = 'flex';
  _dom.overlay.style.opacity = '1';
  _dom.overlay.style.transition = '';
}

// ---------------------------------------------------------------------------
// Shared helper — standard reveal + effects + fade-out tail used by specials
// ---------------------------------------------------------------------------
function _playRevealTail(cfg, startElapsed, onDone) {
  let t = startElapsed;

  _after(t, () => {
    _dom.reveal.style.display = 'flex';
    _dom.reveal.classList.add('cutscene-reveal-enter');
    _particlePhase = 'burst';
    _spawnBurstParticles(cfg);
    _triggerRevealFlash(cfg);
    _shakeOverlay(cfg.level);
    _dom.glow.style.transition = `opacity ${cfg.revealMs}ms ease`;
    _dom.glow.style.opacity = '0.7';
    _after(Math.floor(cfg.revealMs * 0.6), () => _dom.subtitle.classList.add('cutscene-subtitle-enter'));
  });
  t += cfg.revealMs;

  _after(t, () => {
    _particlePhase = 'drift';
    _spawnEffectParticles(cfg);
    if (cfg.shake) {
      _after(Math.floor(cfg.effectsMs * 0.3), () => _shakeOverlay(cfg.level));
      _after(Math.floor(cfg.effectsMs * 0.6), () => _shakeOverlay(cfg.level));
    }
  });
  t += cfg.effectsMs;

  _after(t, () => {
    _dom.overlay.style.transition = `opacity ${cfg.fadeOutMs}ms ease`;
    _dom.overlay.style.opacity = '0';
  });
  t += cfg.fadeOutMs;

  _after(t, () => { _teardownCutscene(); onDone(); });
}

// ---------------------------------------------------------------------------
// Reality Breaker special cutscene — reality fractures
// ---------------------------------------------------------------------------
function _playRealityBreakerCutscene(rank, onDone) {
  const cfg = CUTSCENE_CONFIG[rank.name];
  if (!cfg) { onDone(); return; }

  _currentRankName = rank.name;
  _currentCfg = cfg;
  _dom.rankName.textContent = `${rank.emoji || ''} ${rank.name}`;
  _dom.subtitle.textContent = cfg.subtitle || '';
  _resetSpecialCutsceneDOM(cfg);

  // ── Build DOM elements ──────────────────────────────────────────────────
  const introText = document.createElement('div');
  introText.className = 'rb-intro-text';
  introText.textContent = '"reality was not meant to be broken"';
  _dom.overlay.appendChild(introText);

  const crackContainer = document.createElement('div');
  crackContainer.className = 'rb-crack-container';
  _dom.overlay.appendChild(crackContainer);

  const rbBolt = document.createElement('div');
  rbBolt.className = 'rb-bolt';
  rbBolt.textContent = '⚡';
  _dom.overlay.appendChild(rbBolt);

  const rbWhiteout = document.createElement('div');
  rbWhiteout.className = 'rb-whiteout';
  _dom.overlay.appendChild(rbWhiteout);

  function _cleanup() {
    introText.remove(); crackContainer.remove();
    rbBolt.remove();    rbWhiteout.remove();
    _customCanvasDraw = null;
  }
  _pendingCleanup = _cleanup;

  // ── Canvas lightning ────────────────────────────────────────────────────
  const _rbBolts = [];

  function _genBoltPath(x1, y1, x2, y2, steps, jitter) {
    const pts = [{ x: x1, y: y1 }];
    for (let i = 1; i < steps; i++) {
      const frac = i / steps;
      pts.push({
        x: x1 + (x2 - x1) * frac + (Math.random() - 0.5) * jitter,
        y: y1 + (y2 - y1) * frac + (Math.random() - 0.5) * jitter * 0.4,
      });
    }
    pts.push({ x: x2, y: y2 });
    return pts;
  }

  _customCanvasDraw = function(ctx, canvas) {
    for (let i = _rbBolts.length - 1; i >= 0; i--) {
      const b = _rbBolts[i];
      b.life -= b.decay;
      if (b.life <= 0) { _rbBolts.splice(i, 1); continue; }
      if (b.pts.length < 2) continue;
      // Outer glow
      ctx.save();
      ctx.globalAlpha = b.life * 0.4;
      ctx.strokeStyle = '#88ccff';
      ctx.lineWidth = (b.lw || 2) * 3;
      ctx.shadowBlur = 20;
      ctx.shadowColor = '#88ccff';
      ctx.beginPath();
      ctx.moveTo(b.pts[0].x, b.pts[0].y);
      for (let j = 1; j < b.pts.length; j++) ctx.lineTo(b.pts[j].x, b.pts[j].y);
      ctx.stroke();
      ctx.restore();
      // Bright core
      ctx.save();
      ctx.globalAlpha = b.life;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = b.lw || 2;
      ctx.beginPath();
      ctx.moveTo(b.pts[0].x, b.pts[0].y);
      for (let j = 1; j < b.pts.length; j++) ctx.lineTo(b.pts[j].x, b.pts[j].y);
      ctx.stroke();
      ctx.restore();
    }
  };

  function _flashBolts(count) {
    const cw = (_canvas && _canvas.width)  || window.innerWidth;
    const ch = (_canvas && _canvas.height) || window.innerHeight;
    for (let i = 0; i < count; i++) {
      _after(i * 200, () => {
        _rbBolts.push({
          pts: _genBoltPath(
            (0.1 + Math.random() * 0.8) * cw, 0,
            (0.1 + Math.random() * 0.8) * cw, (0.5 + Math.random() * 0.5) * ch,
            10 + Math.floor(Math.random() * 6), 70
          ),
          life: 1.0, lw: 1.5 + Math.random() * 1.5,
          decay: 0.055 + Math.random() * 0.035,
        });
      });
    }
  }

  function _addCracks(count) {
    for (let i = 0; i < count; i++) {
      const c = document.createElement('div');
      c.className = 'rb-crack';
      c.style.left  = (15 + Math.random() * 70) + '%';
      c.style.top   = (15 + Math.random() * 70) + '%';
      c.style.width = (60 + Math.random() * 120) + 'px';
      c.style.transform = `rotate(${(Math.random() * 180 - 90).toFixed(1)}deg)`;
      crackContainer.appendChild(c);
      setTimeout(() => { c.style.opacity = (0.4 + Math.random() * 0.5).toFixed(2); }, 40);
    }
  }

  _startParticleLoop();
  _playSound(cfg.soundType, cfg.level);

  let t = 0;

  // Phase 1: Cracks begin appearing
  _after(200, () => _addCracks(3));
  _after(420, () => _flashBolts(1));
  _after(620, () => _addCracks(2));
  _after(800, () => _flashBolts(1));
  _after(950, () => _addCracks(3));
  t = 1050;

  // Phase 2: Intro text glitches in
  _after(t, () => {
    introText.style.transition = 'opacity 650ms ease, letter-spacing 650ms ease';
    introText.style.opacity = '1';
    introText.style.letterSpacing = '3px';
    introText.classList.add('rb-text-glitch');
    _dom.scanlines.style.display = 'block';
  });
  t += 650;

  _after(t + 200, () => _flashBolts(2));
  _after(t + 750, () => { _addCracks(4); _flashBolts(2); });
  t += 1450;

  // Phase 2b: Text glitches out
  _after(t, () => {
    introText.style.transition = 'opacity 450ms ease';
    introText.style.opacity = '0';
    introText.classList.remove('rb-text-glitch');
  });
  t += 550;

  // Phase 3: Cracks spread, screen warps
  _after(t, () => {
    _addCracks(5);
    _dom.bgFx.classList.add('cutscene-bg-glitch');
    crackContainer.classList.add('rb-crack-container-active');
    _flashBolts(3);
  });
  t += 700;

  // Phase 4: Lightning strikes center
  _after(t, () => {
    const cw = (_canvas && _canvas.width)  || window.innerWidth;
    const ch = (_canvas && _canvas.height) || window.innerHeight;
    _rbBolts.push({
      pts: _genBoltPath(cw / 2 + (Math.random() - 0.5) * 100, 0, cw / 2, ch / 2, 12, 55),
      life: 1.6, lw: 4, decay: 0.022,
    });
    rbWhiteout.style.transition = 'opacity 120ms ease-in';
    rbWhiteout.style.opacity = '0.55';
    _after(180, () => {
      rbWhiteout.style.transition = 'opacity 420ms ease-out';
      rbWhiteout.style.opacity = '0';
    });
  });
  t += 700;

  // Phase 5: ⚡ symbol appears
  _after(t, () => {
    rbBolt.style.transition = 'opacity 280ms ease, transform 280ms ease';
    rbBolt.style.opacity = '1';
    rbBolt.style.transform = 'translate(-50%, -50%) scale(1)';
    rbBolt.classList.add('rb-bolt-active');
  });
  t += 380;

  // Phase 6: Lightning pulses (3 times)
  _after(t,       () => _flashBolts(1));
  _after(t + 500, () => _flashBolts(2));
  _after(t + 950, () => _flashBolts(2));
  t += 1250;

  // Phase 7: Flash white
  _after(t, () => {
    rbWhiteout.style.transition = 'opacity 350ms ease-in';
    rbWhiteout.style.opacity = '1';
    rbBolt.classList.remove('rb-bolt-active');
    _dom.bgFx.classList.remove('cutscene-bg-glitch');
    _dom.scanlines.style.display = 'none';
    crackContainer.style.transition = 'opacity 200ms ease';
    crackContainer.style.opacity = '0';
  });
  t += 450;

  // Phase 8: Fade back to black
  _after(t, () => {
    rbBolt.style.transition = 'opacity 300ms ease';
    rbBolt.style.opacity = '0';
    rbWhiteout.style.transition = 'opacity 650ms ease-out';
    rbWhiteout.style.opacity = '0';
  });
  t += 750;

  _playRevealTail(cfg, t, onDone);
}

// ---------------------------------------------------------------------------
// Singularity special cutscene — black hole, gravity pull
// ---------------------------------------------------------------------------
function _playSingularityCutscene(rank, onDone) {
  const cfg = CUTSCENE_CONFIG[rank.name];
  if (!cfg) { onDone(); return; }

  _currentRankName = rank.name;
  _currentCfg = cfg;
  _dom.rankName.textContent = `${rank.emoji || ''} ${rank.name}`;
  _dom.subtitle.textContent = cfg.subtitle || '';
  _resetSpecialCutsceneDOM(cfg);

  // ── Build DOM elements ──────────────────────────────────────────────────
  const introText = document.createElement('div');
  introText.className = 'sing-intro-text';
  introText.textContent = '"everything returns to one point"';
  _dom.overlay.appendChild(introText);

  // Ring and hole centered on overlay
  const singWrap = document.createElement('div');
  singWrap.className = 'sing-hole-wrap';
  const singHole = document.createElement('div');
  singHole.className = 'sing-hole';
  const singRing = document.createElement('div');
  singRing.className = 'sing-ring';
  singWrap.appendChild(singHole);
  singWrap.appendChild(singRing);
  _dom.overlay.appendChild(singWrap);

  const singPoint = document.createElement('div');
  singPoint.className = 'sing-collapse-point';
  _dom.overlay.appendChild(singPoint);

  const singWhiteout = document.createElement('div');
  singWhiteout.className = 'sing-whiteout';
  _dom.overlay.appendChild(singWhiteout);

  function _cleanup() {
    introText.remove(); singWrap.remove();
    singPoint.remove(); singWhiteout.remove();
    _customCanvasDraw = null;
  }
  _pendingCleanup = _cleanup;

  // ── Helpers ─────────────────────────────────────────────────────────────
  function _vmin() { return Math.min(window.innerWidth, window.innerHeight); }

  function _setRingSize(frac, durMs) {
    const sz  = Math.floor(_vmin() * frac);
    const hSz = Math.floor(sz * 0.78);
    const tr  = `width ${durMs}ms ease, height ${durMs}ms ease`;
    singRing.style.transition = tr;
    singHole.style.transition  = tr;
    singRing.style.width  = singRing.style.height = sz + 'px';
    singHole.style.width  = singHole.style.height = hSz + 'px';
  }

  function _spawnStars() {
    const cw = (_canvas && _canvas.width)  || window.innerWidth;
    const ch = (_canvas && _canvas.height) || window.innerHeight;
    for (let i = 0; i < 180; i++) {
      _particles.push({
        x: Math.random() * cw, y: Math.random() * ch,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        size: 1 + Math.random() * 2,
        color: _randomColor(['#ffffff', '#ccddff', '#aabbee', '#8899cc']),
        opacity: 0.2 + Math.random() * 0.7,
        life: 1, decay: 0.00015 + Math.random() * 0.0002,
        type: 'drift',
      });
    }
  }

  _startParticleLoop();
  _playSound(cfg.soundType, cfg.level);
  _spawnStars();

  let t = 0;

  // Phase 1: Stars drift, then vortex pulls them inward
  _after(600, () => {
    _particlePhase = 'drift'; // triggers _applyVortex since soundType === 'void'
    _dom.bgFx.classList.add('cutscene-bg-void');
  });
  t = 1400;

  _after(t, () => _spawnStars()); // second wave for density
  t += 300;

  // Phase 2: Intro text
  _after(t, () => {
    introText.style.transition = 'opacity 700ms ease, letter-spacing 700ms ease';
    introText.style.opacity = '1';
    introText.style.letterSpacing = '3px';
  });
  t += 700 + 1000; // fade-in + hold

  // Phase 2b: Text out
  _after(t, () => {
    introText.style.transition = 'opacity 550ms ease';
    introText.style.opacity = '0';
  });
  t += 650;

  // Phase 3: Singularity ring forms
  _after(t, () => {
    singWrap.style.transition = 'opacity 500ms ease';
    singWrap.style.opacity = '1';
    _setRingSize(0.12, 1400);
  });
  t += 1500;

  // Phase 4: Ring grows, screen darkens
  _after(t, () => {
    singRing.classList.add('sing-ring-pulse');
    _setRingSize(0.26, 1800);
    _dom.overlay.style.transition = 'background 2000ms ease';
    _dom.overlay.style.background = '#020005';
  });
  t += 1900;

  // Phase 5: Full-size singularity, screen very dark
  _after(t, () => {
    _setRingSize(0.38, 1600);
    singRing.style.boxShadow = [
      '0 0 40px rgba(180,180,255,1)',
      '0 0 80px rgba(150,150,255,0.7)',
      '0 0 160px rgba(100,100,200,0.35)',
    ].join(',');
    _dom.overlay.style.transition = 'background 1600ms ease';
    _dom.overlay.style.background = '#010003';
    _dom.glow.style.transition = 'opacity 1600ms ease';
    _dom.glow.style.opacity = '0.4';
  });
  t += 1700;

  // Phase 6: Collapse to a point
  _after(t, () => {
    singRing.classList.remove('sing-ring-pulse');
    singRing.style.transition = 'width 550ms ease-in, height 550ms ease-in, opacity 400ms ease';
    singHole.style.transition  = 'width 550ms ease-in, height 550ms ease-in';
    singRing.style.width  = singRing.style.height = '0';
    singHole.style.width  = singHole.style.height = '0';
    singRing.style.opacity = '0';
    singPoint.style.transition = 'opacity 250ms ease';
    singPoint.style.opacity = '1';
    _dom.glow.style.transition = 'opacity 300ms ease';
    _dom.glow.style.opacity = '0';
  });
  t += 650;

  // Phase 7: Bright flash
  _after(t, () => {
    singPoint.style.transition = 'transform 350ms ease-out, opacity 350ms ease-out';
    singPoint.style.transform = 'scale(40)';
    singPoint.style.opacity = '0';
    singWhiteout.style.transition = 'opacity 350ms ease-in';
    singWhiteout.style.opacity = '1';
  });
  t += 450;

  // Phase 8: Fade to black
  _after(t, () => {
    singWrap.style.transition = 'opacity 200ms ease';
    singWrap.style.opacity = '0';
    singWhiteout.style.transition = 'opacity 700ms ease-out';
    singWhiteout.style.opacity = '0';
    _dom.bgFx.classList.remove('cutscene-bg-void');
    _dom.overlay.style.transition = 'background 500ms ease';
    _dom.overlay.style.background = '#000000';
  });
  t += 850;

  _playRevealTail(cfg, t, onDone);
}

// ---------------------------------------------------------------------------
// Infinity special cutscene — endless loop, infinite energy
// ---------------------------------------------------------------------------
function _playInfinityCutscene(rank, onDone) {
  const cfg = CUTSCENE_CONFIG[rank.name];
  if (!cfg) { onDone(); return; }

  _currentRankName = rank.name;
  _currentCfg = cfg;
  _dom.rankName.textContent = `${rank.emoji || ''} ${rank.name}`;
  _dom.subtitle.textContent = cfg.subtitle || '';
  _resetSpecialCutsceneDOM(cfg);

  // ── Build DOM elements ──────────────────────────────────────────────────
  const introText = document.createElement('div');
  introText.className = 'inf-intro-text';
  introText.textContent = '"there is no beginning and no end"';
  _dom.overlay.appendChild(introText);

  const infWhiteout = document.createElement('div');
  infWhiteout.className = 'inf-whiteout';
  _dom.overlay.appendChild(infWhiteout);

  function _cleanup() {
    introText.remove(); infWhiteout.remove();
    _customCanvasDraw = null;
  }
  _pendingCleanup = _cleanup;

  // ── Canvas ∞ symbol state ───────────────────────────────────────────────
  // symbols[]: {opacity, scale, rotOffset, lineWidth, glowSize, drawStart}
  // drawStart: the global frame-progress at which this symbol began drawing
  const _infSymbols = [{ opacity: 1, scale: 1, rotOffset: 0, lineWidth: 3, glowSize: 22 }];
  let _infFrameCount = 0;   // increments every canvas frame
  let _infDrawSpeed  = 0.005; // draw progress added per frame (main symbol)
  let _infRotSpeed   = 0;    // radians per frame added to rotation
  let _infRotation   = 0;
  let _infScreenFade = 0;    // 0→1 for white-fill effect

  _customCanvasDraw = function(ctx, canvas) {
    _infFrameCount++;
    _infRotation += _infRotSpeed;

    const cx = canvas.width  / 2;
    const cy = canvas.height / 2;
    const R  = Math.min(canvas.width, canvas.height) * 0.18;

    // White fill overlay (for the "screen becomes white" phase)
    if (_infScreenFade > 0) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, _infScreenFade);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
      return; // don't draw symbols once fully white
    }

    for (let si = 0; si < _infSymbols.length; si++) {
      const sym = _infSymbols[si];
      if (sym.opacity <= 0.01) continue;

      // Each symbol has its own independent draw progress (0→1)
      sym.drawProgress = Math.min(1, (sym.drawProgress || 0) + (si === 0 ? _infDrawSpeed : _infDrawSpeed * 0.7));

      const endT   = sym.drawProgress * Math.PI * 2;
      const steps  = 180;
      const R2     = R * sym.scale;

      ctx.save();
      ctx.globalAlpha = sym.opacity;
      ctx.translate(cx, cy);
      ctx.rotate(_infRotation * (si === 0 ? 1 : (si % 2 === 0 ? 0.7 : -0.5)) + sym.rotOffset);

      // Glow pass
      ctx.strokeStyle = '#ff8800';
      ctx.lineWidth = sym.lineWidth * 2.5;
      ctx.shadowBlur = sym.glowSize * 2;
      ctx.shadowColor = cfg.color;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.globalAlpha = sym.opacity * 0.35;
      ctx.beginPath();
      for (let k = 0; k <= steps; k++) {
        const tVal = (k / steps) * endT;
        const x = R2 * Math.sin(2 * tVal);
        const y = (R2 / 1.65) * Math.sin(tVal);
        k === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Core bright line
      ctx.strokeStyle = cfg.color;
      ctx.lineWidth = sym.lineWidth;
      ctx.shadowBlur = sym.glowSize;
      ctx.globalAlpha = sym.opacity;
      ctx.beginPath();
      for (let k = 0; k <= steps; k++) {
        const tVal = (k / steps) * endT;
        const x = R2 * Math.sin(2 * tVal);
        const y = (R2 / 1.65) * Math.sin(tVal);
        k === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();

      // White hot centre
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = sym.lineWidth * 0.35;
      ctx.shadowBlur = 0;
      ctx.globalAlpha = sym.opacity * 0.6;
      ctx.beginPath();
      for (let k = 0; k <= steps; k++) {
        const tVal = (k / steps) * endT;
        const x = R2 * Math.sin(2 * tVal);
        const y = (R2 / 1.65) * Math.sin(tVal);
        k === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();

      ctx.restore();
    }
  };

  _startParticleLoop();
  _playSound(cfg.soundType, cfg.level);

  let t = 0;

  // Phase 1: Symbol draws itself
  _after(100, () => { _infDrawSpeed = 0.006; });
  t = 2900; // 0.006/frame × 60fps → ~2.8s to fully draw; add buffer

  // Phase 2: Symbol fully drawn — slow rotation begins
  _after(t, () => {
    _infDrawSpeed = 0; // lock drawing at full
    _infRotSpeed  = 0.004;
  });

  // Intro text
  _after(t + 300, () => {
    introText.style.transition = 'opacity 700ms ease, letter-spacing 700ms ease';
    introText.style.opacity = '1';
    introText.style.letterSpacing = '3px';
  });
  t += 1000;

  // Hold
  t += 1000;

  // Text out
  _after(t, () => {
    introText.style.transition = 'opacity 500ms ease';
    introText.style.opacity = '0';
  });
  t += 600;

  // Phase 3: Multiple background symbols appear
  _after(t, () => {
    _infRotSpeed = 0.008;
    _infDrawSpeed = 0; // extra symbols start fully drawn but fade in
    for (let i = 1; i <= 5; i++) {
      _infSymbols.push({
        opacity: 0,
        scale: 0.55 + i * 0.2,
        rotOffset: (i / 6) * Math.PI * 2,
        lineWidth: 1.5,
        glowSize: 12,
        drawProgress: 1, // pre-drawn
      });
    }
    // Fade in background symbols
    let idx = 1;
    function _fadeNext() {
      if (idx >= _infSymbols.length) return;
      const sym = _infSymbols[idx++];
      const start = performance.now();
      const dur = 400;
      function _tick(now) {
        sym.opacity = Math.min(0.35, ((now - start) / dur) * 0.35);
        if (now - start < dur) requestAnimationFrame(_tick);
      }
      requestAnimationFrame(_tick);
      _after(150, _fadeNext);
    }
    _fadeNext();
  });
  t += 600;

  // Phase 4: Symbols speed up, light trails
  _after(t, () => { _infRotSpeed = 0.025; });
  t += 700;

  _after(t, () => { _infRotSpeed = 0.06; });
  t += 500;

  // Phase 5: Screen fills with light
  _after(t, () => {
    _infRotSpeed = 0.15;
    // Ramp up screen fade
    const start = performance.now();
    const dur = 900;
    function _tick(now) {
      _infScreenFade = (now - start) / dur;
      if (_infScreenFade < 1 && _infRotSpeed > 0) requestAnimationFrame(_tick);
    }
    requestAnimationFrame(_tick);
  });
  t += 950;

  // Phase 6: Fade back to black
  _after(t, () => {
    // Canvas is now filling white; DOM overlay takes over so canvas can clear
    infWhiteout.style.transition = 'none';
    infWhiteout.style.opacity = '1';
    void infWhiteout.offsetWidth; // force layout flush so opacity:1 is committed
    _infScreenFade = 0;
    _infRotSpeed = 0;
    _infSymbols.forEach((s) => { s.opacity = 0; });
    infWhiteout.style.transition = 'opacity 750ms ease-out';
    infWhiteout.style.opacity = '0';
  });
  t += 850;

  _playRevealTail(cfg, t, onDone);
}

// ---------------------------------------------------------------------------
// Cosmic special cutscene — galaxy, stars, nebula
// ---------------------------------------------------------------------------
function _playCosmicCutscene(rank, onDone) {
  const cfg = CUTSCENE_CONFIG[rank.name];
  if (!cfg) { onDone(); return; }

  _currentRankName = rank.name;
  _currentCfg = cfg;
  _dom.rankName.textContent = `${rank.emoji || ''} ${rank.name}`;
  _dom.subtitle.textContent = cfg.subtitle || '';
  _resetSpecialCutsceneDOM(cfg);

  // ── Build DOM elements ──────────────────────────────────────────────────
  const introText = document.createElement('div');
  introText.className = 'cosmic-intro-text';
  introText.textContent = '"you have reached beyond the stars"';
  _dom.overlay.appendChild(introText);

  const galaxyWrap = document.createElement('div');
  galaxyWrap.className = 'cosmic-galaxy-wrap';
  const galaxyDisc = document.createElement('div');
  galaxyDisc.className = 'cosmic-galaxy-disc';
  galaxyWrap.appendChild(galaxyDisc);
  _dom.overlay.appendChild(galaxyWrap);

  const cosmicWhiteout = document.createElement('div');
  cosmicWhiteout.className = 'cosmic-whiteout';
  _dom.overlay.appendChild(cosmicWhiteout);

  function _cleanup() {
    introText.remove(); galaxyWrap.remove();
    cosmicWhiteout.remove();
    _customCanvasDraw = null;
  }
  _pendingCleanup = _cleanup;

  // ── Canvas: starfield scrolling toward edges (space-travel feel) ────────
  let _cosmicStarPhase = 'drift'; // 'drift' → 'travel'
  let _cosmicTravelSpeed = 0;

  _customCanvasDraw = function(ctx, canvas) {
    if (_cosmicStarPhase !== 'travel') return;
    const cx = canvas.width  / 2;
    const cy = canvas.height / 2;
    // Add radial velocity boost to each particle (space-warp streaks)
    for (const p of _particles) {
      const dx = p.x - cx;
      const dy = p.y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      p.vx += (dx / dist) * _cosmicTravelSpeed;
      p.vy += (dy / dist) * _cosmicTravelSpeed;
    }
  };

  function _spawnStarfield() {
    const cw = (_canvas && _canvas.width)  || window.innerWidth;
    const ch = (_canvas && _canvas.height) || window.innerHeight;
    for (let i = 0; i < 160; i++) {
      _particles.push({
        x: Math.random() * cw, y: Math.random() * ch,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        size: 1 + Math.random() * 2.5,
        color: _randomColor(['#ffffff', '#ddddff', '#ffeecc', '#aaccff']),
        opacity: 0.1 + Math.random() * 0.6,
        life: 1, decay: 0.0001 + Math.random() * 0.00015,
        type: 'drift',
      });
    }
  }

  _startParticleLoop();
  _playSound(cfg.soundType, cfg.level);

  // Stars fade in
  _after(80, () => {
    _particlePhase = 'drift';
    _spawnStarfield();
  });

  let t = 0;

  // Phase 1: Starfield visible
  t = 500;

  // Phase 2: Intro text
  _after(t, () => {
    introText.style.transition = 'opacity 700ms ease, letter-spacing 700ms ease';
    introText.style.opacity = '1';
    introText.style.letterSpacing = '3px';
  });
  t += 700 + 1200; // fade-in + hold

  // Text out
  _after(t, () => {
    introText.style.transition = 'opacity 550ms ease';
    introText.style.opacity = '0';
  });
  t += 650;

  // Phase 3: Galaxy swirl forms
  _after(t, () => {
    galaxyWrap.style.transition = 'opacity 1000ms ease';
    galaxyWrap.style.opacity = '1';
    _dom.bgFx.classList.add('cutscene-bg-cosmic');
    _dom.glow.style.transition = 'opacity 1500ms ease';
    _dom.glow.style.opacity = '0.35';
  });
  t += 1100;

  // Phase 4: Stars begin space-travel outward + galaxy spins faster
  _after(t, () => {
    _cosmicStarPhase = 'travel';
    _cosmicTravelSpeed = 0.04;
    galaxyDisc.classList.add('cosmic-galaxy-fast');
    _dom.glow.style.transition = 'opacity 1200ms ease';
    _dom.glow.style.opacity = '0.65';
  });
  t += 600;

  _after(t, () => { _cosmicTravelSpeed = 0.12; });
  t += 500;

  // Phase 5: Galaxy collapses into burst
  _after(t, () => {
    _cosmicTravelSpeed = 0.3;
    galaxyWrap.style.transition = 'opacity 400ms ease, transform 400ms ease';
    galaxyWrap.style.transform = 'translate(-50%, -50%) scale(3)';
    galaxyWrap.style.opacity = '0';
    _dom.glow.style.transition = 'opacity 400ms ease';
    _dom.glow.style.opacity = '1';
  });
  t += 500;

  // Phase 6: Flash white
  _after(t, () => {
    cosmicWhiteout.style.transition = 'opacity 350ms ease-in';
    cosmicWhiteout.style.opacity = '1';
    _dom.bgFx.classList.remove('cutscene-bg-cosmic');
  });
  t += 450;

  // Phase 7: Fade to black
  _after(t, () => {
    cosmicWhiteout.style.transition = 'opacity 700ms ease-out';
    cosmicWhiteout.style.opacity = '0';
    _dom.glow.style.transition = 'opacity 400ms ease';
    _dom.glow.style.opacity = '0';
    _cosmicStarPhase = 'drift';
    _cosmicTravelSpeed = 0;
  });
  t += 800;

  _playRevealTail(cfg, t, onDone);
}

function _playSingleCutscene(rank, onDone) {
  // Special bespoke cinematic sequences per rank
  if (rank.name === 'Overlord')       { _playOverlordCutscene(rank, onDone);       return; }
  if (rank.name === 'Reality Breaker') { _playRealityBreakerCutscene(rank, onDone); return; }
  if (rank.name === 'Singularity')    { _playSingularityCutscene(rank, onDone);    return; }
  if (rank.name === 'Infinity')       { _playInfinityCutscene(rank, onDone);       return; }
  if (rank.name === 'Cosmic')         { _playCosmicCutscene(rank, onDone);         return; }

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
  _customCanvasDraw = null;
  _particlePhase = 'idle';
  _currentCfg = null;
  _currentRankName = '';
  if (typeof _pendingCleanup === 'function') {
    _pendingCleanup();
    _pendingCleanup = null;
  }
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
function isCutscenesPlaying()    { return _playing; }

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

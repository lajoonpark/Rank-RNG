/**
 * settings.js — Game Settings System
 *
 * Manages player preferences including cutscene toggles and sound.
 * Persists to localStorage. Provides a modal settings panel UI
 * accessible via the ⚙️ Settings button.
 *
 * Load order note: this file loads before cutscene.js in the HTML,
 * so CUTSCENE_CONFIG is not yet defined at parse time. The rank name
 * list is derived from CUTSCENE_CONFIG lazily inside initSettings(),
 * which runs during DOMContentLoaded when all scripts are available.
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const SETTINGS_KEY = 'rankRNG_settings_v1';

/**
 * Ordered list of rank names that support cutscenes (rarest first).
 * Populated lazily in initSettings() from CUTSCENE_CONFIG when available,
 * so that settings.js and cutscene.js stay in sync automatically.
 */
let CUTSCENE_RANK_NAMES = [
  'Reality Breaker', 'Singularity', 'Infinity', 'Cosmic',
  'Overlord', 'Ruler', 'Transcendent', 'Celestial', 'Eternal', 'Immortal',
];

/** Overwrite the rank list from CUTSCENE_CONFIG once it is loaded. */
function _syncRankNamesFromConfig() {
  if (typeof CUTSCENE_CONFIG !== 'undefined') {
    // Preserve the rarest-first order defined in CUTSCENE_CONFIG
    CUTSCENE_RANK_NAMES = Object.keys(CUTSCENE_CONFIG).reverse();
  }
}

// ---------------------------------------------------------------------------
// Settings state
// ---------------------------------------------------------------------------
let _settings = null;

function _defaultSettings() {
  const perRank = {};
  CUTSCENE_RANK_NAMES.forEach((name) => { perRank[name] = true; });
  return {
    cutscenes: {
      globalEnabled: true,
      perRank,
    },
    sound: {
      enabled: true,
    },
  };
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------
function loadSettings() {
  _settings = _defaultSettings();
  const raw = localStorage.getItem(SETTINGS_KEY);
  if (!raw) return;
  try {
    const saved = JSON.parse(raw);
    if (saved.cutscenes) {
      if (typeof saved.cutscenes.globalEnabled === 'boolean') {
        _settings.cutscenes.globalEnabled = saved.cutscenes.globalEnabled;
      }
      if (saved.cutscenes.perRank && typeof saved.cutscenes.perRank === 'object') {
        CUTSCENE_RANK_NAMES.forEach((name) => {
          if (typeof saved.cutscenes.perRank[name] === 'boolean') {
            _settings.cutscenes.perRank[name] = saved.cutscenes.perRank[name];
          }
        });
      }
    }
    if (saved.sound && typeof saved.sound.enabled === 'boolean') {
      _settings.sound.enabled = saved.sound.enabled;
    }
  } catch (e) {
    console.warn('Failed to load settings:', e);
  }
}

function saveSettings() {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(_settings));
  } catch (e) {
    console.warn('Failed to save settings:', e);
  }
}

// ---------------------------------------------------------------------------
// Public API — queried by cutscene.js before playing
// ---------------------------------------------------------------------------
function isCutsceneEnabled(rankName) {
  if (!_settings) return false;
  if (!_settings.cutscenes.globalEnabled) return false;
  return _settings.cutscenes.perRank[rankName] !== false;
}

function isSoundEnabled() {
  return _settings ? _settings.sound.enabled !== false : false;
}

// ---------------------------------------------------------------------------
// Settings Panel — DOM
// ---------------------------------------------------------------------------
function _createSettingsPanel() {
  const overlay = document.createElement('div');
  overlay.id = 'settings-overlay';
  overlay.className = 'settings-overlay';
  overlay.style.display = 'none';

  overlay.innerHTML = `
    <div class="settings-panel" role="dialog" aria-modal="true" aria-label="Settings">
      <div class="settings-header">
        <span class="settings-title">⚙️ Settings</span>
        <button id="settings-close-btn" class="settings-close-btn" aria-label="Close settings">✕</button>
      </div>
      <div class="settings-body">

        <div class="settings-section">
          <h3 class="settings-section-title">🎬 Cutscenes</h3>
          <div class="settings-row">
            <span class="settings-label">Enable all cutscenes</span>
            <label class="settings-toggle">
              <input type="checkbox" id="setting-cutscenes-global">
              <span class="settings-toggle-track"><span class="settings-toggle-thumb"></span></span>
            </label>
          </div>
          <div class="settings-row">
            <span class="settings-label">🔊 Cutscene sound effects</span>
            <label class="settings-toggle">
              <input type="checkbox" id="setting-sound">
              <span class="settings-toggle-track"><span class="settings-toggle-thumb"></span></span>
            </label>
          </div>
        </div>

        <div class="settings-section" id="settings-per-rank-section">
          <h3 class="settings-section-title">Per-Rank Cutscenes</h3>
          <p class="settings-hint">Uncheck to skip the cutscene for individual ranks.</p>
          <div id="settings-per-rank-list"></div>
        </div>

      </div>
    </div>
  `;

  document.body.appendChild(overlay);
}

function _populatePerRankList() {
  const list = document.getElementById('settings-per-rank-list');
  if (!list) return;

  // Build a quick lookup for rank info (emoji, color) from RANKS if available
  const rankMap = {};
  if (typeof RANKS !== 'undefined') {
    RANKS.forEach((r) => { rankMap[r.name] = r; });
  }
  const specialFX = typeof SPECIAL_COLOR_FX !== 'undefined' ? SPECIAL_COLOR_FX : [];
  const fallbacks = typeof SPECIAL_COLOR_FALLBACKS !== 'undefined' ? SPECIAL_COLOR_FALLBACKS : {};

  list.innerHTML = CUTSCENE_RANK_NAMES.map((name) => {
    const rank = rankMap[name];
    const emoji = rank ? rank.emoji : '⭐';
    const rawColor = rank ? rank.color : '#ffffff';
    const color = specialFX.includes(rawColor) ? (fallbacks[rawColor] || '#ffffff') : rawColor;
    const safeId = `setting-rank-${name.replace(/\s+/g, '-')}`;
    return `
      <div class="settings-row settings-rank-row">
        <span class="settings-label" style="color:${color}">${emoji} ${name}</span>
        <label class="settings-toggle">
          <input type="checkbox" id="${safeId}" data-rank="${name}">
          <span class="settings-toggle-track"><span class="settings-toggle-thumb"></span></span>
        </label>
      </div>`;
  }).join('');
}

function _syncToUI() {
  const globalEl = document.getElementById('setting-cutscenes-global');
  const soundEl = document.getElementById('setting-sound');
  if (globalEl) globalEl.checked = _settings.cutscenes.globalEnabled;
  if (soundEl) soundEl.checked = _settings.sound.enabled;

  CUTSCENE_RANK_NAMES.forEach((name) => {
    const el = document.getElementById(`setting-rank-${name.replace(/\s+/g, '-')}`);
    if (el) el.checked = _settings.cutscenes.perRank[name] !== false;
  });

  // Dim the per-rank section when global cutscenes are off
  const perRankSection = document.getElementById('settings-per-rank-section');
  if (perRankSection) {
    perRankSection.style.opacity = _settings.cutscenes.globalEnabled ? '1' : '0.4';
    perRankSection.style.pointerEvents = _settings.cutscenes.globalEnabled ? '' : 'none';
  }
}

function _attachSettingsEvents() {
  const overlay = document.getElementById('settings-overlay');
  if (!overlay) return;

  // Close button
  document.getElementById('settings-close-btn').addEventListener('click', closeSettings);

  // Click the backdrop to close
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeSettings();
  });

  // Global cutscenes toggle
  const globalEl = document.getElementById('setting-cutscenes-global');
  if (globalEl) {
    globalEl.addEventListener('change', () => {
      _settings.cutscenes.globalEnabled = globalEl.checked;
      saveSettings();
      _syncToUI();
    });
  }

  // Sound toggle
  const soundEl = document.getElementById('setting-sound');
  if (soundEl) {
    soundEl.addEventListener('change', () => {
      _settings.sound.enabled = soundEl.checked;
      saveSettings();
    });
  }

  // Per-rank toggles (delegated)
  const list = document.getElementById('settings-per-rank-list');
  if (list) {
    list.addEventListener('change', (e) => {
      const rankName = e.target.dataset.rank;
      if (rankName && typeof rankName === 'string') {
        _settings.cutscenes.perRank[rankName] = e.target.checked;
        saveSettings();
      }
    });
  }
}

// ---------------------------------------------------------------------------
// Open / Close
// ---------------------------------------------------------------------------
function openSettings() {
  const overlay = document.getElementById('settings-overlay');
  if (!overlay) return;
  _syncToUI();
  overlay.style.display = 'flex';
  requestAnimationFrame(() => overlay.classList.add('open'));
}

function closeSettings() {
  const overlay = document.getElementById('settings-overlay');
  if (!overlay) return;
  overlay.classList.remove('open');
  setTimeout(() => { overlay.style.display = 'none'; }, 300);
}

// ---------------------------------------------------------------------------
// Initialise — called from game.js DOMContentLoaded
// ---------------------------------------------------------------------------
function initSettings() {
  // Derive rank list from CUTSCENE_CONFIG now that all scripts are loaded
  _syncRankNamesFromConfig();
  loadSettings();
  _createSettingsPanel();
  _populatePerRankList();
  _syncToUI();
  _attachSettingsEvents();

  const settingsBtn = document.getElementById('settings-btn');
  if (settingsBtn) {
    settingsBtn.addEventListener('click', openSettings);
  }
}

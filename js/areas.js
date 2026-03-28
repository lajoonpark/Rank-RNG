/**
 * areas.js — Areas / Worlds / Biomes System
 *
 * Defines all areas with their themes, unlock requirements, and rank boost
 * modifiers.  Provides the AreaSystem class for tracking the active area and
 * unlocked-area state, and manages the Areas modal panel UI.
 *
 * Integration points:
 *   • rng.js    – getActiveBoosts() feeds area multipliers into buildAdjustedChances()
 *   • game.js   – areaSystem.checkUnlocks() called after every roll batch
 *   • game.js   – save/load via toJSON() / constructor(savedData)
 *   • ui.js     – renderActiveArea() reads getActiveArea()
 *
 * Area boost mechanic:
 *   Each area carries a `boosts` map of { rankId: multiplier }.
 *   In rng.js the formula becomes:
 *     raw = baseChance * (boosts[id] || 1) * (1 + luck * rarityLevel * 0.02)
 *   Because all weights are renormalised to 100 % afterwards, total probability
 *   always stays valid while boosted ranks receive a relative advantage.
 */

// ---------------------------------------------------------------------------
// Area definitions
// ---------------------------------------------------------------------------
const AREA_CONFIG = [
  {
    id: 'starter_plains',
    name: 'Starter Plains',
    emoji: '🌿',
    description: 'A balanced beginner area. All ranks drop at standard odds.',
    theme: {
      bgGradient: 'linear-gradient(160deg, #0d0f1a 0%, #131626 60%, #0d0f1a 100%)',
      accentColor: '#7c4dff',
      panelBorder: '#2e3452',
      panelGlow:   'none',
    },
    boosts: {},
    unlockRequirement: { type: 'default' },
    unlockHint: 'Unlocked by default',
    boostHint: 'Balanced odds — no rank is specifically favoured',
  },
  {
    id: 'overlord_chamber',
    name: 'Overlord Chamber',
    emoji: '🏰',
    description: 'A dark regal domain. Diamond-tier power lurks in every shadow.',
    theme: {
      bgGradient: 'linear-gradient(160deg, #0a0005 0%, #180010 50%, #0d000a 100%)',
      accentColor: '#FF1744',
      panelBorder: '#4a0015',
      panelGlow:   '0 0 60px rgba(255,23,68,0.08) inset',
    },
    boosts: { overlord: 5 },
    unlockRequirement: { type: 'rank', rankId: 'overlord' },
    unlockHint: 'Obtain Overlord once',
    boostHint: '💎 Overlord odds slightly boosted',
  },
  {
    id: 'cosmic_expanse',
    name: 'Cosmic Expanse',
    emoji: '🌌',
    description: 'A vast starfield where nebula forces bend the odds in your favour.',
    theme: {
      bgGradient: 'linear-gradient(160deg, #050010 0%, #0a0530 50%, #020015 100%)',
      accentColor: '#ff6600',
      panelBorder: '#1a1045',
      panelGlow:   '0 0 60px rgba(255,102,0,0.07) inset',
    },
    boosts: { cosmic: 5 },
    unlockRequirement: { type: 'rolls', value: 10000 },
    unlockHint: 'Reach 10,000 total rolls',
    boostHint: '🌌 Cosmic odds slightly boosted',
  },
  {
    id: 'infinity_nexus',
    name: 'Infinity Nexus',
    emoji: '♾️',
    description: 'A looping realm beyond time where infinite possibilities converge.',
    theme: {
      bgGradient: 'linear-gradient(160deg, #000808 0%, #001a18 50%, #000810 100%)',
      accentColor: '#00E5FF',
      panelBorder: '#003040',
      panelGlow:   '0 0 60px rgba(0,229,255,0.07) inset',
    },
    boosts: { infinity: 5 },
    unlockRequirement: { type: 'rank', rankId: 'infinity' },
    unlockHint: 'Obtain Infinity once',
    boostHint: '♾️ Infinity odds slightly boosted',
  },
  {
    id: 'singularity_void',
    name: 'Singularity Void',
    emoji: '🕳️',
    description: 'A collapsing point of impossible density. Only the strongest survive.',
    theme: {
      bgGradient: 'linear-gradient(160deg, #000000 0%, #050005 50%, #000000 100%)',
      accentColor: '#888888',
      panelBorder: '#222222',
      panelGlow:   '0 0 80px rgba(100,100,100,0.06) inset',
    },
    boosts: { singularity: 5 },
    unlockRequirement: { type: 'rolls', value: 50000 },
    unlockHint: 'Reach 50,000 total rolls',
    boostHint: '🕳️ Singularity odds slightly boosted',
  },
  {
    id: 'fractured_reality',
    name: 'Fractured Reality',
    emoji: '⚡',
    description: 'Reality has shattered. The laws of probability no longer apply.',
    theme: {
      bgGradient: 'linear-gradient(160deg, #050005 0%, #1a0025 40%, #000010 100%)',
      accentColor: '#ff0044',
      panelBorder: '#3a0020',
      panelGlow:   '0 0 60px rgba(255,0,68,0.08) inset',
    },
    boosts: { reality_breaker: 5 },
    unlockRequirement: { type: 'rank', rankId: 'reality_breaker' },
    unlockHint: 'Obtain Reality Breaker once',
    boostHint: '⚡ Reality Breaker odds slightly boosted',
  },
];

// ---------------------------------------------------------------------------
// AreaSystem class
// ---------------------------------------------------------------------------
class AreaSystem {
  /**
   * @param {object|null} savedData – serialised state from toJSON(), or null
   */
  constructor(savedData = null) {
    /** Active area ID. */
    this.activeAreaId = 'starter_plains';

    /** Set of unlocked area IDs. Starter Plains is always included. */
    this.unlockedAreaIds = new Set(['starter_plains']);

    if (savedData) {
      // Restore active area (validate it is still a known area)
      if (savedData.activeAreaId && AREA_CONFIG.find((a) => a.id === savedData.activeAreaId)) {
        this.activeAreaId = savedData.activeAreaId;
      }

      // Restore unlocked areas
      if (Array.isArray(savedData.unlockedAreaIds)) {
        savedData.unlockedAreaIds.forEach((id) => {
          if (AREA_CONFIG.find((a) => a.id === id)) {
            this.unlockedAreaIds.add(id);
          }
        });
      }
    }
  }

  // ---- Queries -------------------------------------------------------------

  /** @returns {object} active area config object from AREA_CONFIG */
  getActiveArea() {
    return AREA_CONFIG.find((a) => a.id === this.activeAreaId) || AREA_CONFIG[0];
  }

  /** @returns {boolean} whether the given area is unlocked */
  isUnlocked(areaId) {
    return this.unlockedAreaIds.has(areaId);
  }

  /**
   * Return rank boost multipliers for the currently active area.
   * @returns {{ [rankId: string]: number }}
   */
  getActiveBoosts() {
    return this.getActiveArea().boosts;
  }

  // ---- Mutations -----------------------------------------------------------

  /**
   * Switch to a different area.  The area must already be unlocked.
   *
   * @param {string} areaId
   * @returns {boolean} true if the switch succeeded, false if area is locked or unknown
   */
  setActiveArea(areaId) {
    if (!this.isUnlocked(areaId)) return false;
    if (!AREA_CONFIG.find((a) => a.id === areaId)) return false;
    this.activeAreaId = areaId;
    return true;
  }

  /**
   * Evaluate all locked areas and unlock any whose requirements are now met.
   *
   * @param {{ totalRolls: number, ranksEverObtained: Set<string> }} progress
   * @returns {string[]} IDs of areas newly unlocked by this call
   */
  checkUnlocks(progress) {
    const newlyUnlocked = [];
    for (const area of AREA_CONFIG) {
      if (this.isUnlocked(area.id)) continue;
      if (this._meetsRequirement(area.unlockRequirement, progress)) {
        this.unlockedAreaIds.add(area.id);
        newlyUnlocked.push(area.id);
      }
    }
    return newlyUnlocked;
  }

  /** @private */
  _meetsRequirement(req, progress) {
    switch (req.type) {
      case 'default': return true;
      case 'rolls':   return progress.totalRolls >= req.value;
      case 'rank':    return progress.ranksEverObtained.has(req.rankId);
      default:        return false;
    }
  }

  // ---- Serialisation -------------------------------------------------------

  toJSON() {
    return {
      activeAreaId:    this.activeAreaId,
      unlockedAreaIds: [...this.unlockedAreaIds],
    };
  }
}

// ---------------------------------------------------------------------------
// Areas Panel — modal overlay (mirrors the settings panel pattern)
// ---------------------------------------------------------------------------

/** Create and inject the areas overlay DOM.  Called once during initAreas(). */
function _createAreasPanel() {
  const overlay = document.createElement('div');
  overlay.id = 'areas-overlay';
  overlay.className = 'areas-overlay';
  overlay.style.display = 'none';

  overlay.innerHTML = `
    <div class="areas-panel" role="dialog" aria-modal="true" aria-label="Areas">
      <div class="areas-header">
        <span class="areas-title">🗺️ Areas</span>
        <button id="areas-close-btn" class="areas-close-btn" aria-label="Close areas panel">✕</button>
      </div>
      <div class="areas-body">
        <p class="areas-intro-hint">
          Different areas slightly favour different ranks.
          Select an area to roll in its environment.
        </p>
        <div class="areas-grid" id="areas-grid">
          <!-- Populated by renderAreasPanel() -->
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
}

/**
 * Re-render the areas grid to reflect the current AreaSystem state.
 * Safe to call at any time after initAreas().
 *
 * @param {AreaSystem} areaSystem
 */
function renderAreasPanel(areaSystem) {
  const grid = document.getElementById('areas-grid');
  if (!grid || !areaSystem) return;

  grid.innerHTML = AREA_CONFIG.map((area) => {
    const unlocked = areaSystem.isUnlocked(area.id);
    const isActive = areaSystem.activeAreaId === area.id;

    const statusBadge = isActive
      ? '<span class="area-badge area-badge-active">✔ Active</span>'
      : unlocked
        ? ''
        : `<span class="area-badge area-badge-locked">🔒 Locked</span>`;

    const unlockInfo = unlocked
      ? ''
      : `<p class="area-unlock-req">Unlock: ${area.unlockHint}</p>`;

    const actionBtn = isActive
      ? `<button class="area-select-btn area-select-btn-active" disabled>Currently Active</button>`
      : unlocked
        ? `<button class="area-select-btn" data-area-id="${area.id}">Select Area</button>`
        : `<button class="area-select-btn area-select-btn-locked" disabled>🔒 Locked</button>`;

    return `
      <div class="area-card${isActive ? ' area-card-active' : ''}${unlocked ? '' : ' area-card-locked'}"
           style="--area-accent: ${area.theme.accentColor}">
        <div class="area-card-header">
          <span class="area-card-emoji">${area.emoji}</span>
          <div class="area-card-title-block">
            <span class="area-card-name">${area.name}</span>
            ${statusBadge}
          </div>
        </div>
        <p class="area-card-desc">${area.description}</p>
        <p class="area-card-boost">${area.boostHint}</p>
        ${unlockInfo}
        ${actionBtn}
      </div>`;
  }).join('');
}

/**
 * Open the areas panel and refresh its contents.
 *
 * @param {AreaSystem} areaSystem
 */
function openAreasPanel(areaSystem) {
  const overlay = document.getElementById('areas-overlay');
  if (!overlay) return;
  renderAreasPanel(areaSystem);
  overlay.style.display = 'flex';
  requestAnimationFrame(() => overlay.classList.add('open'));
}

/** Close the areas panel. */
function closeAreasPanel() {
  const overlay = document.getElementById('areas-overlay');
  if (!overlay) return;
  overlay.classList.remove('open');
  setTimeout(() => { overlay.style.display = 'none'; }, 300);
}

/**
 * Apply the active area's visual theme to the page.
 * Sets CSS custom properties on <body> consumed by the area theme rules.
 *
 * @param {object} areaTheme – theme object from an AREA_CONFIG entry
 */
function applyAreaTheme(areaTheme) {
  const root = document.documentElement;
  root.style.setProperty('--area-bg-gradient', areaTheme.bgGradient);
  root.style.setProperty('--area-accent',      areaTheme.accentColor);
  root.style.setProperty('--area-panel-glow',  areaTheme.panelGlow);
  root.style.setProperty('--area-panel-border', areaTheme.panelBorder);
}

// ---------------------------------------------------------------------------
// Initialise
// ---------------------------------------------------------------------------

/**
 * Initialise the areas panel and wire all events.
 * Must be called after DOMContentLoaded with a valid AreaSystem instance.
 *
 * @param {function(): AreaSystem} getAreaSystem  – getter that always returns the current AreaSystem
 * @param {function(string): void} onAreaSelect   – callback when player selects an area
 */
function initAreas(getAreaSystem, onAreaSelect) {
  _createAreasPanel();

  const overlay = document.getElementById('areas-overlay');
  if (!overlay) return;

  // Close button
  document.getElementById('areas-close-btn').addEventListener('click', closeAreasPanel);

  // Click backdrop to close
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeAreasPanel();
  });

  // Area select buttons (delegated)
  overlay.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-area-id]');
    if (btn) {
      const areaId = btn.dataset.areaId;
      onAreaSelect(areaId);
    }
  });

  // Areas button in footer — always opens with the current AreaSystem
  const areasBtn = document.getElementById('areas-btn');
  if (areasBtn) {
    areasBtn.addEventListener('click', () => openAreasPanel(getAreaSystem()));
  }

  // Apply initial theme
  applyAreaTheme(getAreaSystem().getActiveArea().theme);
}

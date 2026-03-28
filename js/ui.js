/**
 * ui.js — UI Rendering
 *
 * All DOM manipulation is centralised here.  The game logic calls
 * these functions whenever state changes; no DOM access happens in
 * the other modules.
 */

// ---------------------------------------------------------------------------
// Special colour-effect keywords and fallback border colours
//
// Ranks whose `color` field is one of these keywords receive a CSS animation
// class instead of an inline hex colour.  The fallback colours are used for
// list-item borders and other places that need a concrete colour value.
// ---------------------------------------------------------------------------
const SPECIAL_COLOR_FX = ['gradient', 'rainbow', 'blackhole', 'glitch'];

const SPECIAL_COLOR_FALLBACKS = {
  gradient: '#ff6600',
  rainbow:  '#ff0000',
  blackhole: '#666666',
  glitch:   '#ff0044',
};

// ---------------------------------------------------------------------------
// Rarity-based animation system
// ---------------------------------------------------------------------------

/**
 * Maps each of the top-10 rarest rank names to an animation level (1–10).
 * Level 1 = Immortal (least rare of the top 10), 10 = Reality Breaker (rarest).
 */
const ANIMATION_RANK_LEVELS = {
  'Immortal':        1,
  'Eternal':         2,
  'Celestial':       3,
  'Transcendent':    4,
  'Ruler':           5,
  'Overlord':        6,
  'Cosmic':          7,
  'Infinity':        8,
  'Singularity':     9,
  'Reality Breaker': 10,
};

/** Build-up hold duration (ms) before the rank name is revealed, indexed by level 0–10. */
const BUILDUP_DELAY_MS = [0, 0, 0, 0, 0, 0, 400, 600, 900, 1200, 1600];

/** Entrance animation duration (ms), indexed by level 0–10. */
const ENTER_DURATION_MS = [400, 500, 700, 1000, 1300, 1600, 2000, 2400, 2800, 3200, 3600];

/** Screen-shake animation duration (ms) for levels 8–10 (must match CSS). */
const SCREEN_SHAKE_DURATION_MS = [0, 0, 0, 0, 0, 0, 0, 0, 500, 700, 900];

/** Number of sparkle particles spawned per level (0 for levels below 5). */
const PARTICLE_COUNTS = [0, 0, 0, 0, 0, 5, 7, 10, 14, 18, 22];

/** Base opacity for the background flash overlay (scales with level above 6). */
const FLASH_BASE_OPACITY        = 0.08;
const FLASH_OPACITY_INCREMENT   = 0.04;
const FLASH_MIN_LEVEL           = 6;

/** Particle animation duration: base + level × multiplier (seconds). */
const PARTICLE_BASE_DUR         = 0.5;
const PARTICLE_DUR_PER_LEVEL    = 0.12;

// ---------------------------------------------------------------------------
// Cached DOM references (populated on DOMContentLoaded)
// ---------------------------------------------------------------------------
const UI = {
  currency: null,
  totalValue: null,
  totalItems: null,
  rollResultContainer: null,
  rollBtn: null,
  rollBtnLabel: null,
  inventoryList: null,
  upgradeList: null,
  statsRolls: null,
  statsEarned: null,
  oddsTable: null,
  saveBtn: null,
  resetBtn: null,
  autoRollToggleBtn: null,
  cooldownBar: null,
};

function initUI() {
  UI.currency = document.getElementById('currency');
  UI.totalValue = document.getElementById('total-value');
  UI.totalItems = document.getElementById('total-items');
  UI.rollResultContainer = document.getElementById('roll-result-container');
  UI.rollBtn = document.getElementById('roll-btn');
  UI.rollBtnLabel = document.getElementById('roll-btn-label');
  UI.inventoryList = document.getElementById('inventory-list');
  UI.upgradeList = document.getElementById('upgrade-list');
  UI.statsRolls = document.getElementById('stats-rolls');
  UI.statsEarned = document.getElementById('stats-earned');
  UI.oddsTable = document.getElementById('odds-table');
  UI.saveBtn = document.getElementById('save-btn');
  UI.resetBtn = document.getElementById('reset-btn');
  UI.autoRollToggleBtn = document.getElementById('auto-roll-toggle');
  UI.cooldownBar = document.getElementById('cooldown-bar');
}

// ---------------------------------------------------------------------------
// Number formatting helpers
// ---------------------------------------------------------------------------
function fmtNumber(n) {
  if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return Math.floor(n).toLocaleString();
}

/**
 * Format a percentage chance with enough decimal places to always show
 * a non-zero value for ultra-rare drops.
 * e.g.  40.0453% → "40.0453%"   0.000100% → "0.000100%"
 *
 * @param {number} pct – percentage value (0–100)
 * @returns {string}
 */
function fmtChance(pct) {
  if (pct === 0) return '0%';
  // Show enough decimals so the first significant digit is visible
  const decimals = pct >= 0.01 ? 4 : Math.max(4, -Math.floor(Math.log10(pct)) + 2);
  return pct.toFixed(decimals) + '%';
}

// ---------------------------------------------------------------------------
// Currency / stats bar
// ---------------------------------------------------------------------------
function renderCurrency(player) {
  UI.currency.textContent = fmtNumber(player.currency);
}

function renderStats(stats) {
  UI.statsRolls.textContent = fmtNumber(stats.totalRolls);
  UI.statsEarned.textContent = fmtNumber(stats.totalEarned);
}

// ---------------------------------------------------------------------------
// Roll result display
// ---------------------------------------------------------------------------

/**
 * Apply colour styling (including animated special effects) to an element.
 * Removes any previously applied fx classes before setting the new state.
 *
 * @param {HTMLElement} el    – element to style (text node)
 * @param {string}      color – rank color (hex string or special keyword)
 */
function applyRankColorToEl(el, color) {
  SPECIAL_COLOR_FX.forEach((fx) => el.classList.remove(`fx-${fx}`));
  el.style.color = '';

  if (SPECIAL_COLOR_FX.includes(color)) {
    el.classList.add(`fx-${color}`);
  } else {
    el.style.color = color;
  }
}

/**
 * Create and return a single roll result card DOM element for the given rank.
 * Handles plain hex colours and special animated effects.
 * Adds an extra glow animation for rarityLevel >= 10.
 *
 * @param {object} result – rank object from RANKS
 * @returns {HTMLElement}
 */
function createRollCard(result) {
  const cardEl = document.createElement('div');
  cardEl.className = 'roll-result-card';

  const nameEl = document.createElement('div');
  nameEl.className = 'roll-result-name';
  nameEl.textContent = `${result.emoji} ${result.name}`;
  cardEl.appendChild(nameEl);

  const isSpecial = SPECIAL_COLOR_FX.includes(result.color);

  if (isSpecial) {
    // Animated text effect
    nameEl.classList.add(`fx-${result.color}`);
    // Animated card border/glow
    cardEl.style.setProperty('--rank-color', SPECIAL_COLOR_FALLBACKS[result.color]);
    cardEl.classList.add(`fx-card-${result.color}`);
  } else {
    // Plain hex colour — apply inline styles directly
    nameEl.style.color = result.color;
    cardEl.style.borderColor = result.color;
    cardEl.style.boxShadow = `0 0 18px ${result.color}88`;
    cardEl.style.setProperty('--rank-color', result.color);
  }

  // Extra pulsing glow for high-rarity drops (rarityLevel >= 10)
  if (result.rarityLevel >= 10) {
    cardEl.classList.add('fx-card-ultra-rare');
  }

  return cardEl;
}

/**
 * Returns animation level (1–10) for a rank name, or 0 for non-rare ranks.
 * @param {string} rankName
 * @returns {number}
 */
function getAnimationLevel(rankName) {
  return ANIMATION_RANK_LEVELS[rankName] || 0;
}

/**
 * Trigger a brief screen-shake on the page wrapper for top-3 ranks (levels 8–10).
 * @param {number} level – animation level (8, 9, or 10)
 */
function triggerScreenShake(level) {
  const wrapper = document.querySelector('.wrapper');
  if (!wrapper) return;
  const cls = `screen-shake-${level}`;
  wrapper.classList.remove('screen-shake-8', 'screen-shake-9', 'screen-shake-10');
  void wrapper.offsetWidth; // reflow so re-adding the same class restarts the animation
  wrapper.classList.add(cls);
  setTimeout(() => wrapper.classList.remove(cls), SCREEN_SHAKE_DURATION_MS[level]);
}

/**
 * Flash a translucent colour overlay across the viewport for top-5 ranks (levels 6–10).
 * Intensity scales with level.
 * @param {string} color – CSS colour string
 * @param {number} level – animation level (6–10)
 */
function triggerBackgroundFlash(color, level) {
  let overlay = document.getElementById('rare-flash-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'rare-flash-overlay';
    document.body.appendChild(overlay);
  }
  const maxOpacity = (FLASH_BASE_OPACITY + (level - FLASH_MIN_LEVEL) * FLASH_OPACITY_INCREMENT).toFixed(2);
  overlay.style.backgroundColor = color;
  overlay.style.setProperty('--flash-max', maxOpacity);
  overlay.classList.remove('flash-active');
  void overlay.offsetWidth; // reflow to restart animation
  overlay.classList.add('flash-active');
}

/**
 * Spawn animated sparkle particles flying outward from the centre of a card.
 * @param {HTMLElement} cardEl – card element to attach particles to
 * @param {string}      color  – particle colour
 * @param {number}      level  – animation level (5–10)
 */
function spawnParticles(cardEl, color, level) {
  const count  = PARTICLE_COUNTS[level] || 0;
  const baseDur = PARTICLE_BASE_DUR + level * PARTICLE_DUR_PER_LEVEL;

  for (let i = 0; i < count; i++) {
    const p = document.createElement('span');
    p.className = 'rank-particle';
    const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.7;
    const dist  = 50 + Math.random() * 70 * (level / 10);
    p.style.setProperty('--px', `${(Math.cos(angle) * dist).toFixed(1)}px`);
    p.style.setProperty('--py', `${(Math.sin(angle) * dist).toFixed(1)}px`);
    p.style.backgroundColor = color;
    const size = 3 + Math.random() * 4;
    p.style.width  = `${size.toFixed(1)}px`;
    p.style.height = `${size.toFixed(1)}px`;
    const dur   = baseDur + Math.random() * 0.4;
    const delay = Math.random() * 0.15;
    p.style.animation = `particleFly ${dur.toFixed(2)}s ease-out ${delay.toFixed(2)}s forwards`;
    cardEl.appendChild(p);
    setTimeout(() => p.remove(), (dur + delay + 0.35) * 1000);
  }
}

/**
 * Apply a rarity-based entrance animation to a freshly-mounted roll card.
 *
 * - Levels 1–5:  direct entrance animation with increasing intensity
 * - Levels 6–10: build-up pulse (showing ???) then a dramatic reveal
 * - Levels 6–10: background flash on reveal
 * - Levels 8–10: screen shake on reveal
 * - Levels 5–10: sparkle particles at entrance
 *
 * Uses inline style.animation to override any concurrent fx-card-* class
 * animations during the entrance; the class animations resume automatically
 * once the inline style is cleared.
 *
 * @param {HTMLElement} cardEl  – the roll-result card element (already in DOM)
 * @param {object}      result  – rank object from RANKS
 */
function applyRarityAnimation(cardEl, result) {
  const level = getAnimationLevel(result.name);
  if (level === 0) {
    cardEl.classList.add('roll-animate');
    return;
  }

  const rankColor = SPECIAL_COLOR_FX.includes(result.color)
    ? SPECIAL_COLOR_FALLBACKS[result.color]
    : result.color;
  const enterDurMs = ENTER_DURATION_MS[level];
  const easing     = 'cubic-bezier(0.17, 0.67, 0.83, 0.67)';

  /** Start the entrance animation plus associated screen effects. */
  const startEntrance = () => {
    cardEl.style.animation = `enterLevel${level} ${enterDurMs}ms ${easing} forwards`;
    spawnParticles(cardEl, rankColor, level);
    if (level >= 6) triggerBackgroundFlash(rankColor, level);
    if (level >= 8) triggerScreenShake(level);
    // Clear inline style when the animation ends so fx-card-* classes resume
    setTimeout(() => { cardEl.style.animation = ''; }, enterDurMs);
  };

  if (level <= 5) {
    // Immediate entrance — no build-up phase
    cardEl.style.animation = `enterLevel${level} ${enterDurMs}ms ${easing} forwards`;
    if (level >= 5) spawnParticles(cardEl, rankColor, level);
    setTimeout(() => { cardEl.style.animation = ''; }, enterDurMs);
  } else {
    // Build-up phase: pulse with ??? then reveal the actual rank name
    const nameEl   = cardEl.querySelector('.roll-result-name');
    const fullText = nameEl.textContent;
    nameEl.textContent = '???';
    cardEl.style.animation = 'buildUpPulse 0.45s ease-in-out infinite';
    setTimeout(() => {
      nameEl.textContent = fullText;
      startEntrance();
    }, BUILDUP_DELAY_MS[level]);
  }
}

/**
 * Show all roll results from the current batch, one card per result.
 *
 * Accepts either plain rank objects or { rank, isPityReward } objects.
 * When isPityReward is true the card receives a "✨ PITY" badge.
 *
 * @param {Array} rolledItems – rank objects or { rank, isPityReward } objects
 */
function renderRollResult(rolledItems) {
  if (!UI.rollResultContainer) return;
  if (!rolledItems || rolledItems.length === 0) return;

  UI.rollResultContainer.replaceChildren();

  // Normalise: support both plain rank objects and { rank, isPityReward } shape
  const items = rolledItems.map((item) =>
    item && typeof item === 'object' && 'rank' in item
      ? { rank: item.rank, isPityReward: item.isPityReward ?? false }
      : { rank: item, isPityReward: false }
  );

  items.forEach(({ rank: result, isPityReward }) => {
    const card = createRollCard(result);

    if (isPityReward) {
      card.classList.add('pity-reward-card');
      const badge = document.createElement('div');
      badge.className = 'pity-badge';
      badge.textContent = '✨ PITY';
      card.appendChild(badge);
    }

    UI.rollResultContainer.appendChild(card);
    // Trigger roll animation after the element is in the DOM
    requestAnimationFrame(() => applyRarityAnimation(card, result));
  });
}

// ---------------------------------------------------------------------------
// Inventory panel
// ---------------------------------------------------------------------------
function renderInventory(inventory) {
  const entries = inventory.getSortedEntries();

  UI.totalValue.textContent = fmtNumber(inventory.getTotalValue());
  UI.totalItems.textContent = fmtNumber(inventory.getTotalCount());

  if (entries.length === 0) {
    UI.inventoryList.innerHTML =
      '<p class="empty-msg">No items yet. Start rolling!</p>';
    return;
  }

  UI.inventoryList.innerHTML = entries
    .map((entry) => {
      const { rank } = entry;
      const isSpecial = SPECIAL_COLOR_FX.includes(rank.color);
      // Border uses a plain colour; special effects get a fallback hex
      const borderColor = isSpecial
        ? SPECIAL_COLOR_FALLBACKS[rank.color]
        : rank.color;
      // Name span: class-based animation OR inline colour
      const nameHtml = isSpecial
        ? `<span class="inv-name fx-${rank.color}">${rank.name}</span>`
        : `<span class="inv-name" style="color:${rank.color}">${rank.name}</span>`;

      return `
      <div class="inv-row" style="border-left: 4px solid ${borderColor}">
        <span class="inv-icon">${rank.emoji}</span>
        ${nameHtml}
        <span class="inv-qty">x${fmtNumber(entry.quantity)}</span>
        <span class="inv-val">${fmtNumber(entry.totalValue)} 💰</span>
        <button class="sell-btn" data-id="${rank.id}" title="Sell all ${rank.name}">
          Sell All
        </button>
      </div>`;
    })
    .join('');
}

// ---------------------------------------------------------------------------
// Upgrade shop
// ---------------------------------------------------------------------------
function renderUpgrades(player) {
  UI.upgradeList.innerHTML = Object.values(UPGRADE_DEFS)
    .map((def) => {
      const level = player.upgrades[def.id];
      const cost = player.getUpgradeCost(def.id);
      const maxed = cost === null;
      const canAfford = !maxed && player.currency >= cost;

      const levelDisplay =
        def.maxLevel === 1
          ? maxed
            ? '✔ Unlocked'
            : 'Locked'
          : `Lv ${level}${def.maxLevel ? ' / ' + def.maxLevel : ''}`;

      return `
        <div class="upgrade-card${maxed ? ' maxed' : ''}">
          <div class="upgrade-header">
            <span class="upgrade-label">${def.label}</span>
            <span class="upgrade-level">${levelDisplay}</span>
          </div>
          <p class="upgrade-desc">${def.description}</p>
          <button
            class="upgrade-btn${canAfford ? ' affordable' : ''}"
            data-upgrade="${def.id}"
            ${maxed ? 'disabled' : ''}
          >
            ${maxed ? 'MAX' : `Upgrade — ${fmtNumber(cost)} 💰`}
          </button>
        </div>`;
    })
    .join('');

  // Show / hide the auto-roll toggle button
  if (UI.autoRollToggleBtn) {
    UI.autoRollToggleBtn.style.display =
      player.autoRollActive ? 'inline-flex' : 'none';
  }
}

// ---------------------------------------------------------------------------
// Roll button state
// ---------------------------------------------------------------------------
function setRollButtonEnabled(enabled, rollsPerClick) {
  UI.rollBtn.disabled = !enabled;
  UI.rollBtnLabel.textContent =
    rollsPerClick > 1 ? `Roll ×${rollsPerClick}` : 'Roll';
}

// ---------------------------------------------------------------------------
// Cooldown progress bar
// ---------------------------------------------------------------------------
function animateCooldownBar(durationMs) {
  if (!UI.cooldownBar) return;
  UI.cooldownBar.style.transition = 'none';
  UI.cooldownBar.style.width = '100%';
  // Let the browser paint the full bar before starting drain
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      UI.cooldownBar.style.transition = `width ${durationMs}ms linear`;
      UI.cooldownBar.style.width = '0%';
    });
  });
}

// ---------------------------------------------------------------------------
// Odds table (shown in a collapsible section)
// ---------------------------------------------------------------------------
function renderOdds(luckLevel, areaBoosts = {}) {
  const chances = getDropChances(luckLevel, areaBoosts);
  const boostedIds = Object.keys(areaBoosts);
  UI.oddsTable.innerHTML = chances
    .slice()
    .reverse() // rarest first
    .map((c) => {
      const rank = RANKS.find((r) => r.id === c.id);
      const isSpecial = SPECIAL_COLOR_FX.includes(rank.color);
      const nameHtml = isSpecial
        ? `<span class="fx-${rank.color}">${rank.name}</span>`
        : `<span style="color:${rank.color}">${rank.name}</span>`;
      const boostedMark = boostedIds.includes(rank.id)
        ? ' <span class="odds-boost-mark" title="Boosted by active area">▲</span>'
        : '';
      return `
        <tr>
          <td>${rank.emoji} ${nameHtml}${boostedMark}</td>
          <td>${fmtChance(c.chance)}</td>
          <td>${fmtNumber(rank.value)} 💰</td>
        </tr>`;
    })
    .join('');
}

// ---------------------------------------------------------------------------
// Auto-roll toggle button label
// ---------------------------------------------------------------------------
function setAutoRollBtnLabel(running) {
  if (!UI.autoRollToggleBtn) return;
  UI.autoRollToggleBtn.textContent = running
    ? '⏹ Stop Auto-Roll'
    : '▶ Start Auto-Roll';
  UI.autoRollToggleBtn.classList.toggle('active', running);
}

// ---------------------------------------------------------------------------
// Pity System UI
// ---------------------------------------------------------------------------

/**
 * Initialise the pity rank-selector buttons.
 * Call once after the DOM is ready and pitySystem has been created.
 *
 * @param {function} onTargetChange – callback(rankId: string|null) invoked
 *                                    when the player selects or deselects a rank
 */
function initPityUI(onTargetChange) {
  const container = document.getElementById('pity-rank-buttons');
  if (!container) return;

  container.innerHTML = '';

  PITY_CONFIG.forEach((config) => {
    const btn = document.createElement('button');
    btn.className = 'pity-rank-btn';
    btn.dataset.rankId = config.id;
    btn.title = `Guarantee in ${config.threshold.toLocaleString()} rolls`;

    // Label: emoji + name + subtle threshold hint
    btn.innerHTML =
      `<span class="pity-btn-name">${config.emoji} ${config.name}</span>` +
      `<span class="pity-btn-req">${config.threshold.toLocaleString()}</span>`;

    btn.addEventListener('click', () => onTargetChange(config.id));
    container.appendChild(btn);
  });
}

/**
 * Refresh the pity progress display to match the current PitySystem state.
 * Safe to call with a null pitySystem (renders a blank state).
 *
 * @param {PitySystem|null} pitySystem
 */
function renderPity(pitySystem) {
  const targetNameEl   = document.getElementById('pity-target-name');
  const progressTextEl = document.getElementById('pity-progress-text');
  const remainingEl    = document.getElementById('pity-remaining-text');
  const barEl          = document.getElementById('pity-bar');
  const progressArea   = document.getElementById('pity-progress-area');

  if (!targetNameEl || !barEl) return;

  // Sync button active-state highlights
  document.querySelectorAll('.pity-rank-btn').forEach((btn) => {
    const isActive = pitySystem && btn.dataset.rankId === pitySystem.targetId;
    btn.classList.toggle('active', Boolean(isActive));
  });

  if (!pitySystem) {
    targetNameEl.textContent  = 'No target selected';
    progressTextEl.textContent = '— / —';
    remainingEl.textContent   = 'Select a rank above to track pity progress.';
    barEl.style.width         = '0%';
    barEl.setAttribute('aria-valuenow', '0');
    progressArea.classList.remove('pity-close', 'pity-charged');
    return;
  }

  const config   = pitySystem.getTargetConfig();
  const progress = pitySystem.getTargetProgress();

  if (!config) {
    targetNameEl.textContent  = 'No target selected';
    progressTextEl.textContent = '— / —';
    remainingEl.textContent   = 'Select a rank above to track pity progress.';
    barEl.style.width         = '0%';
    barEl.setAttribute('aria-valuenow', '0');
    progressArea.classList.remove('pity-close', 'pity-charged');
    return;
  }

  const threshold = config.threshold;
  const remaining = Math.max(0, threshold - progress);
  const pct       = Math.min(100, (progress / threshold) * 100);

  targetNameEl.textContent  = `${config.emoji} ${config.name}`;
  progressTextEl.textContent = `${progress.toLocaleString()} / ${threshold.toLocaleString()}`;
  barEl.style.width          = `${pct.toFixed(2)}%`;
  barEl.setAttribute('aria-valuenow', pct.toFixed(0));

  if (remaining === 0) {
    remainingEl.textContent = '✨ Pity ready — next roll guarantees this rank!';
  } else {
    remainingEl.textContent = `${remaining.toLocaleString()} rolls remaining`;
  }

  // Visual charge states (based on fill percentage)
  progressArea.classList.toggle('pity-close',   pct >= 80 && pct < 95);
  progressArea.classList.toggle('pity-charged', pct >= 95);
}

// ---------------------------------------------------------------------------
// Active Area indicator (displayed on the roll panel)
// ---------------------------------------------------------------------------

/**
 * Update the active-area indicator strip on the roll panel.
 * Safe to call with a null areaSystem.
 *
 * @param {AreaSystem|null} areaSystem
 */
function renderActiveArea(areaSystem) {
  const indicator = document.getElementById('active-area-indicator');
  if (!indicator) return;

  if (!areaSystem) {
    indicator.style.display = 'none';
    return;
  }

  const area = areaSystem.getActiveArea();
  const emojiEl = document.getElementById('active-area-emoji');
  const nameEl  = document.getElementById('active-area-name');
  const hintEl  = document.getElementById('active-area-hint');

  if (emojiEl) emojiEl.textContent = area.emoji;
  if (nameEl)  nameEl.textContent  = area.name;
  if (hintEl)  hintEl.textContent  = area.boostHint;

  // Apply the area's accent colour as a CSS custom property on the indicator
  indicator.style.setProperty('--area-accent', area.theme.accentColor);
  indicator.style.display = 'flex';
}

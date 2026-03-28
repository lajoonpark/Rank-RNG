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
 * Show all roll results from the current batch, one card per result.
 *
 * @param {object[]} rolledRanks – array of rank objects from this roll batch
 */
function renderRollResult(rolledRanks) {
  if (!UI.rollResultContainer) return;
  if (!rolledRanks || rolledRanks.length === 0) return;

  UI.rollResultContainer.replaceChildren();

  rolledRanks.forEach((result) => {
    const card = createRollCard(result);
    UI.rollResultContainer.appendChild(card);
    // Trigger roll-pop animation after the element is in the DOM
    requestAnimationFrame(() => {
      card.classList.add('roll-animate');
    });
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
function renderOdds(luckLevel) {
  const chances = getDropChances(luckLevel);
  UI.oddsTable.innerHTML = chances
    .slice()
    .reverse() // rarest first
    .map((c) => {
      const rank = RANKS.find((r) => r.id === c.id);
      const isSpecial = SPECIAL_COLOR_FX.includes(rank.color);
      const nameHtml = isSpecial
        ? `<span class="fx-${rank.color}">${rank.name}</span>`
        : `<span style="color:${rank.color}">${rank.name}</span>`;
      return `
        <tr>
          <td>${rank.emoji} ${nameHtml}</td>
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

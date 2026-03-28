/**
 * ui.js — UI Rendering
 *
 * All DOM manipulation is centralised here.  The game logic calls
 * these functions whenever state changes; no DOM access happens in
 * the other modules.
 */

// ---------------------------------------------------------------------------
// Cached DOM references (populated on DOMContentLoaded)
// ---------------------------------------------------------------------------
const UI = {
  currency: null,
  totalValue: null,
  totalItems: null,
  rollResult: null,
  rollResultCard: null,
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
  UI.rollResult = document.getElementById('roll-result-name');
  UI.rollResultCard = document.getElementById('roll-result-card');
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
 * Show the result of the most recent (or best) roll.
 *
 * @param {object[]} rolledRanks – array of rank objects from this roll batch
 */
function renderRollResult(rolledRanks) {
  if (!rolledRanks || rolledRanks.length === 0) return;

  // Pick the rarest rank from the batch to display
  const best = rolledRanks.reduce((prev, cur) =>
    RANKS.findIndex((r) => r.id === cur.id) >
    RANKS.findIndex((r) => r.id === prev.id)
      ? cur
      : prev
  );

  UI.rollResult.textContent = `${best.emoji} ${best.name}`;
  UI.rollResultCard.style.setProperty('--rank-color', best.color);
  UI.rollResultCard.style.borderColor = best.color;
  UI.rollResultCard.style.boxShadow = `0 0 18px ${best.color}88`;

  // Animate
  UI.rollResultCard.classList.remove('roll-animate');
  // Force reflow to restart animation
  void UI.rollResultCard.offsetWidth;
  UI.rollResultCard.classList.add('roll-animate');

  if (rolledRanks.length > 1) {
    const extra = rolledRanks.length - 1;
    UI.rollResultCard.dataset.extra = `+${extra} more`;
  } else {
    UI.rollResultCard.dataset.extra = '';
  }
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
    .map(
      (entry) => `
      <div class="inv-row" style="border-left: 4px solid ${entry.rank.color}">
        <span class="inv-icon">${entry.rank.emoji}</span>
        <span class="inv-name" style="color:${entry.rank.color}">${entry.rank.name}</span>
        <span class="inv-qty">x${fmtNumber(entry.quantity)}</span>
        <span class="inv-val">${fmtNumber(entry.totalValue)} 💰</span>
        <button class="sell-btn" data-id="${entry.rank.id}" title="Sell all ${entry.rank.name}">
          Sell All
        </button>
      </div>`
    )
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
      return `
        <tr>
          <td>${rank.emoji} <span style="color:${rank.color}">${rank.name}</span></td>
          <td>${c.chance.toFixed(3)}%</td>
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

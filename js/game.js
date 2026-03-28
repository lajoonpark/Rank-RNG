/**
 * game.js — Game Loop & Orchestration
 *
 * Wires together all modules: RNG, PlayerState, Inventory, and UI.
 * Handles rolling logic, auto-roll timer, upgrade purchases, selling,
 * and save / load via localStorage.
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const SAVE_KEY = 'rankRNG_save';
const CURRENCY_PER_ROLL = 1; // flat currency bonus per individual roll
const AUTO_ROLL_TICK_MS = 100; // how often the auto-roll scheduler runs

// ---------------------------------------------------------------------------
// Game state (module-level singletons)
// ---------------------------------------------------------------------------
let player = null;
let inventory = null;
let totalRolls = 0;

let rollOnCooldown = false;
let autoRollRunning = false;
let autoRollTimer = null;
let lastAutoRollTime = 0;

// ---------------------------------------------------------------------------
// Save / Load
// ---------------------------------------------------------------------------
function saveGame() {
  const data = {
    player: player.toJSON(),
    inventory: inventory.toJSON(),
    totalRolls,
  };
  localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  showToast('Game saved! 💾');
}

function loadGame() {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) return false;
  try {
    const data = JSON.parse(raw);
    player = new PlayerState(data.player);
    inventory = new Inventory(data.inventory);
    totalRolls = data.totalRolls ?? 0;
    return true;
  } catch (e) {
    console.warn('Failed to load save:', e);
    return false;
  }
}

function resetGame() {
  if (!confirm('Reset all progress? This cannot be undone!')) return;
  localStorage.removeItem(SAVE_KEY);
  stopAutoRoll();
  player = new PlayerState();
  inventory = new Inventory();
  totalRolls = 0;
  refreshAll();
  showToast('Game reset. Good luck! 🎲');
}

// ---------------------------------------------------------------------------
// Toast notification
// ---------------------------------------------------------------------------
function showToast(msg) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add('visible');
  setTimeout(() => toast.classList.remove('visible'), 2500);
}

// ---------------------------------------------------------------------------
// Core roll logic
// ---------------------------------------------------------------------------
function doRoll() {
  if (rollOnCooldown) return;

  const count = player.rollsPerClick;
  const rolledRanks = [];

  for (let i = 0; i < count; i++) {
    const rank = rollRank(player.upgrades.luck);
    const rankIndex = RANKS.findIndex((r) => r.id === rank.id);

    // Apply bonus multiplier to Rare and above (index >= 2)
    const multiplier = rankIndex >= 2 ? player.bonusMultiplier : 1;
    const value = Math.ceil(rank.value * multiplier);

    inventory.addRank(rank, value);
    player.earn(value + CURRENCY_PER_ROLL);
    rolledRanks.push(rank);
  }

  totalRolls += count;

  // Update UI
  renderRollResult(rolledRanks);
  renderCurrency(player);
  renderInventory(inventory);
  renderStats({ totalRolls, totalEarned: player.totalEarned });
  renderUpgrades(player);

  // Start cooldown
  startCooldown();
}

function startCooldown() {
  rollOnCooldown = true;
  setRollButtonEnabled(false, player.rollsPerClick);
  animateCooldownBar(player.rollCooldownMs);

  setTimeout(() => {
    rollOnCooldown = false;
    setRollButtonEnabled(true, player.rollsPerClick);
  }, player.rollCooldownMs);
}

// ---------------------------------------------------------------------------
// Auto-roll
// ---------------------------------------------------------------------------
function startAutoRoll() {
  if (!player.autoRollActive) return;
  autoRollRunning = true;
  lastAutoRollTime = 0;
  setAutoRollBtnLabel(true);

  autoRollTimer = setInterval(() => {
    if (!rollOnCooldown) {
      doRoll();
    }
  }, AUTO_ROLL_TICK_MS);
}

function stopAutoRoll() {
  autoRollRunning = false;
  clearInterval(autoRollTimer);
  autoRollTimer = null;
  setAutoRollBtnLabel(false);
}

function toggleAutoRoll() {
  if (autoRollRunning) {
    stopAutoRoll();
  } else {
    startAutoRoll();
  }
}

// ---------------------------------------------------------------------------
// Upgrade purchase handler
// ---------------------------------------------------------------------------
function handleUpgradePurchase(upgradeId) {
  const success = player.buyUpgrade(upgradeId);
  if (!success) {
    showToast('Not enough coins! 💸');
    return;
  }
  renderCurrency(player);
  renderUpgrades(player);
  renderOdds(player.upgrades.luck);
  // Update roll button label in case multiRoll changed
  setRollButtonEnabled(!rollOnCooldown, player.rollsPerClick);

  // If auto-roll was just unlocked, show the toggle
  if (upgradeId === 'autoRoll') {
    document.getElementById('auto-roll-toggle').style.display = 'inline-flex';
    showToast('Auto-Roll unlocked! 🤖');
  }
}

// ---------------------------------------------------------------------------
// Sell handler
// ---------------------------------------------------------------------------
function handleSell(rankId) {
  const refund = inventory.sellAll(rankId);
  if (refund > 0) {
    player.earn(refund);
    renderCurrency(player);
    renderInventory(inventory);
    renderUpgrades(player);
    showToast(`Sold for ${fmtNumber(refund)} 💰`);
  }
}

// ---------------------------------------------------------------------------
// Full UI refresh
// ---------------------------------------------------------------------------
function refreshAll() {
  renderCurrency(player);
  renderInventory(inventory);
  renderUpgrades(player);
  renderStats({ totalRolls, totalEarned: player.totalEarned });
  renderOdds(player.upgrades.luck);
  setRollButtonEnabled(true, player.rollsPerClick);
  setAutoRollBtnLabel(autoRollRunning);
}

// ---------------------------------------------------------------------------
// Event wiring
// ---------------------------------------------------------------------------
function attachEvents() {
  // Manual roll
  document.getElementById('roll-btn').addEventListener('click', doRoll);

  // Upgrade buttons (delegated)
  document.getElementById('upgrade-list').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-upgrade]');
    if (btn) handleUpgradePurchase(btn.dataset.upgrade);
  });

  // Sell buttons (delegated)
  document.getElementById('inventory-list').addEventListener('click', (e) => {
    const btn = e.target.closest('.sell-btn');
    if (btn) handleSell(btn.dataset.id);
  });

  // Save / Reset
  document.getElementById('save-btn').addEventListener('click', saveGame);
  document.getElementById('reset-btn').addEventListener('click', resetGame);

  // Auto-roll toggle
  const autoBtn = document.getElementById('auto-roll-toggle');
  if (autoBtn) autoBtn.addEventListener('click', toggleAutoRoll);

  // Odds section toggle
  const oddsToggle = document.getElementById('odds-toggle');
  const oddsSection = document.getElementById('odds-section');
  if (oddsToggle && oddsSection) {
    oddsToggle.addEventListener('click', () => {
      const open = oddsSection.classList.toggle('open');
      oddsToggle.textContent = open ? '▲ Hide Odds' : '▼ Show Odds';
    });
  }

  // Auto-save every 30 seconds
  setInterval(saveGame, 30_000);
}

// ---------------------------------------------------------------------------
// Initialise
// ---------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  initUI();

  const loaded = loadGame();
  if (!loaded) {
    player = new PlayerState();
    inventory = new Inventory();
  }

  attachEvents();
  refreshAll();

  if (loaded) showToast('Save loaded! 🎮');
});

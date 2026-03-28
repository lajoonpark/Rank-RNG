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
let pitySystem = null;
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
    pity: pitySystem ? pitySystem.toJSON() : null,
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
    pitySystem = new PitySystem(data.pity ?? null);
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
  pitySystem = new PitySystem();
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

  // Process all rolls through the pity system.
  // Returns { rank, isPityReward }[] — one entry per roll.
  // If no pity target is selected the pity system simply forwards to rollItem.
  const results = pitySystem.processRolls(count, player.upgrades.luck);

  const rolledRanks = [];
  for (const { rank, isPityReward } of results) {
    // Apply bonus multiplier to Rare and above (rarityLevel >= 4)
    const multiplier = rank.rarityLevel >= 4 ? player.bonusMultiplier : 1;
    const value = Math.ceil(rank.value * multiplier);

    inventory.addRank(rank, value);
    player.earn(value + CURRENCY_PER_ROLL);
    rolledRanks.push(rank);

    if (isPityReward) {
      showToast(`🎯 Pity triggered! Guaranteed ${rank.emoji} ${rank.name}!`);
    }
  }

  totalRolls += count;

  // Update UI
  renderRollResult(results);
  renderCurrency(player);
  renderInventory(inventory);
  renderStats({ totalRolls, totalEarned: player.totalEarned });
  renderUpgrades(player);
  renderPity(pitySystem);

  // Queue cutscenes for any rare ranks that have one configured.
  // Stop auto-roll first so it does not continue running in the background
  // during the cutscene. Skip if a cutscene is already playing.
  if (typeof queueCutscenes === 'function') {
    const cutsceneRanks = rolledRanks.filter(shouldPlayCutscene);
    if (cutsceneRanks.length > 0 &&
        (typeof isCutscenesPlaying !== 'function' || !isCutscenesPlaying())) {
      stopAutoRoll();
      queueCutscenes(cutsceneRanks);
    }
  }

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
// Cutscene helpers
// ---------------------------------------------------------------------------

/**
 * Returns true when a cutscene will actually play for the given rank —
 * i.e. the cutscene system is enabled globally, the rank's individual
 * cutscene is enabled, and a config entry exists for it.
 */
function shouldPlayCutscene(rank) {
  if (typeof CUTSCENE_CONFIG === 'undefined' || !CUTSCENE_CONFIG[rank.name]) return false;
  if (typeof isCutsceneEnabled !== 'function') return false;
  return isCutsceneEnabled(rank.name);
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
  if (!autoRollRunning) return;
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
  renderPity(pitySystem);
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

  // Settings and cutscene system must init before loadGame/refreshAll
  if (typeof initSettings === 'function') initSettings();
  if (typeof initCutsceneSystem === 'function') initCutsceneSystem();

  const loaded = loadGame();
  if (!loaded) {
    player = new PlayerState();
    inventory = new Inventory();
    pitySystem = new PitySystem();
  }

  attachEvents();

  // Wire pity rank-selector; toggling an already-active button deselects it
  if (typeof initPityUI === 'function') {
    initPityUI((rankId) => {
      const newTarget = pitySystem.targetId === rankId ? null : rankId;
      pitySystem.setTarget(newTarget);
      renderPity(pitySystem);
    });
  }

  refreshAll();

  if (loaded) showToast('Save loaded! 🎮');
});

/**
 * devmode.js — Developer Mode
 *
 * A hidden developer panel protected by passcode "2012".
 * Activate by pressing the backtick (`) key — a prompt will ask for the
 * passcode.  All dev features are disabled when isDevMode is false.
 *
 * Exposed globals (used by rng.js at call-time):
 *   isDevMode          – boolean; true only after correct passcode entry
 *   devLuckMultiplier  – number  ; multiplies player luck before RNG (0–100)
 *   devForcedRank      – string|null; rank ID to return on every roll, or null
 *   devGuaranteedRare  – boolean ; when true, restrict roll pool to Rare+
 *
 * Public functions:
 *   enableDevMode(passcode)
 *   setLuckMultiplier(value)
 *   setMoney(amount)
 *   forceRoll(rankId)
 */

// ---------------------------------------------------------------------------
// Dev mode state (read by rng.js at call-time via global scope)
// ---------------------------------------------------------------------------
let isDevMode = false;
let devLuckMultiplier = 1;   // effective luck = player.luck * devLuckMultiplier
let devForcedRank = null;    // rank ID string, or null for normal roll
let devGuaranteedRare = false; // restrict pool to rarityLevel >= 4

// ---------------------------------------------------------------------------
// Passcode entry
// ---------------------------------------------------------------------------

/**
 * Attempt to activate developer mode with the given passcode.
 * The correct passcode is "2012".
 *
 * @param {string|number} passcode
 * @returns {boolean} true if access was granted
 */
function enableDevMode(passcode) {
  if (String(passcode) === '2012') {
    isDevMode = true;
    showDevPanel();
    showToast('🛠 Dev Mode activated!');
    return true;
  }
  showToast('🚫 Access Denied');
  return false;
}

// ---------------------------------------------------------------------------
// Dev controls
// ---------------------------------------------------------------------------

/**
 * Set the luck multiplier applied on top of the player's luck level.
 * Range: 0 (no luck) – 100 (100× luck).
 *
 * @param {number|string} value
 */
function setLuckMultiplier(value) {
  if (!isDevMode) return;
  const parsed = parseFloat(value);
  devLuckMultiplier = isNaN(parsed) ? 1 : Math.max(0, Math.min(100, parsed));
}

/**
 * Set the player's coin balance directly.
 *
 * @param {number|string} amount
 */
function setMoney(amount) {
  if (!isDevMode) return;
  if (typeof player === 'undefined' || !player) return;
  const parsed = parseFloat(amount);
  if (isNaN(parsed) || parsed < 0) return;
  player.currency = parsed;
  renderCurrency(player);
  renderUpgrades(player);
}

/**
 * Pin the RNG to always return the given rank on every roll.
 * Pass an empty string or null to return to normal rolling.
 *
 * @param {string|null} rankId
 */
function forceRoll(rankId) {
  if (!isDevMode) return;
  devForcedRank = rankId || null;
}

/**
 * Bypass any active cooldown and trigger a single roll.
 * Both the "Force Roll" and "Trigger Multi-Roll" buttons use this helper.
 * Guards against the unlikely case where game.js globals aren't available.
 */
function devTriggerRoll() {
  if (!isDevMode) return;
  // Bypass the cooldown flag (declared in game.js) so the roll fires immediately
  if (typeof rollOnCooldown !== 'undefined') rollOnCooldown = false;
  if (typeof doRoll === 'function') doRoll();
}

// ---------------------------------------------------------------------------
// Dev panel show / hide
// ---------------------------------------------------------------------------

function showDevPanel() {
  const panel = document.getElementById('dev-panel');
  if (panel) panel.style.display = 'block';
}

function hideDevPanel() {
  isDevMode = false;
  devLuckMultiplier = 1;
  devForcedRank = null;
  devGuaranteedRare = false;

  const panel = document.getElementById('dev-panel');
  if (panel) panel.style.display = 'none';

  // Reset control state to defaults
  const slider = document.getElementById('dev-luck-mult');
  const sliderLabel = document.getElementById('dev-luck-mult-val');
  if (slider) slider.value = 1;
  if (sliderLabel) sliderLabel.textContent = '1x';

  const forceSelect = document.getElementById('dev-force-rank');
  if (forceSelect) forceSelect.value = '';

  const rareToggle = document.getElementById('dev-guaranteed-rare');
  if (rareToggle) rareToggle.checked = false;

  showToast('🛠 Dev Mode disabled');
}

// ---------------------------------------------------------------------------
// Keyboard shortcut: backtick (`) opens the passcode prompt
// ---------------------------------------------------------------------------
document.addEventListener('keydown', (e) => {
  // Backtick key opens the passcode prompt; ignore if already in dev mode
  if ((e.key === '`' || e.key === 'Dead') && !isDevMode) {
    const passcode = prompt('🛠 Enter Dev Mode passcode:');
    if (passcode !== null) enableDevMode(passcode.trim());
  }
});

// ---------------------------------------------------------------------------
// Wire up dev panel controls after DOM is ready
// ---------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  // Populate the "Force Rank" dropdown with all rank options
  const forceSelect = document.getElementById('dev-force-rank');
  if (forceSelect) {
    RANKS.forEach((r) => {
      const opt = document.createElement('option');
      opt.value = r.id;
      opt.textContent = `${r.emoji} ${r.name}`;
      forceSelect.appendChild(opt);
    });
  }

  // Close button
  const closeBtn = document.getElementById('dev-close-btn');
  if (closeBtn) closeBtn.addEventListener('click', hideDevPanel);

  // Luck multiplier slider
  const luckSlider = document.getElementById('dev-luck-mult');
  const luckLabel = document.getElementById('dev-luck-mult-val');
  if (luckSlider && luckLabel) {
    luckSlider.addEventListener('input', () => {
      setLuckMultiplier(luckSlider.value);
      luckLabel.textContent = `${devLuckMultiplier}x`;
    });
  }

  // Set money button
  const moneyBtn = document.getElementById('dev-money-btn');
  const moneyInput = document.getElementById('dev-money-input');
  if (moneyBtn && moneyInput) {
    moneyBtn.addEventListener('click', () => {
      const amt = parseFloat(moneyInput.value);
      setMoney(amt);
      if (!isNaN(amt) && amt >= 0) {
        showToast(`💰 Coins set to ${fmtNumber(Math.floor(amt))}`);
      }
    });
  }

  // Force rank dropdown — update devForcedRank on change
  if (forceSelect) {
    forceSelect.addEventListener('change', (e) => {
      forceRoll(e.target.value);
    });
  }

  // Force roll button — bypass cooldown and roll once with current settings
  const forceRollBtn = document.getElementById('dev-force-roll-btn');
  if (forceRollBtn) {
    forceRollBtn.addEventListener('click', devTriggerRoll);
  }

  // Trigger multi-roll button — bypass cooldown and roll once (uses player's rollsPerClick)
  const multiRollBtn = document.getElementById('dev-multi-roll-btn');
  if (multiRollBtn) {
    multiRollBtn.addEventListener('click', devTriggerRoll);
  }

  // Dev button — opens passcode prompt (or re-shows panel if already active)
  const devBtn = document.getElementById('dev-btn');
  if (devBtn) {
    devBtn.addEventListener('click', () => {
      if (isDevMode) {
        showDevPanel();
      } else {
        const passcode = prompt('🛠 Enter Dev Mode passcode:');
        if (passcode !== null) enableDevMode(passcode.trim());
      }
    });
  }

  // Guaranteed rare toggle
  const rareToggle = document.getElementById('dev-guaranteed-rare');
  if (rareToggle) {
    rareToggle.addEventListener('change', (e) => {
      if (!isDevMode) return;
      devGuaranteedRare = e.target.checked;
    });
  }
});

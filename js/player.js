/**
 * player.js — Player State
 *
 * Tracks all mutable game state: currency, upgrade levels, and
 * auto-roll status.  Upgrade cost formulas are centralised here
 * so balancing tweaks only need to happen in one place.
 */

// ---------------------------------------------------------------------------
// Upgrade definitions
// Each upgrade has:
//   id           – unique key
//   label        – display name
//   description  – short explanation shown in the shop
//   baseCost     – cost for level 1
//   costMult     – multiplier applied for each subsequent level
//   maxLevel     – hard cap (null = unlimited)
// ---------------------------------------------------------------------------
const UPGRADE_DEFS = {
  luck: {
    id: 'luck',
    label: '🍀 Luck',
    description: 'Shifts RNG weights toward rarer drops.',
    baseCost: 50,
    costMult: 2.5,
    maxLevel: 20,
  },
  multiRoll: {
    id: 'multiRoll',
    label: '🎲 Multi-Roll',
    description: 'Roll an extra time per click.',
    baseCost: 200,
    costMult: 3.0,
    maxLevel: 9, // level 1–9 gives 2–10 rolls per click
  },
  rollSpeed: {
    id: 'rollSpeed',
    label: '⚡ Roll Speed',
    description: 'Reduces cooldown between rolls.',
    baseCost: 100,
    costMult: 2.0,
    maxLevel: 10,
  },
  autoRoll: {
    id: 'autoRoll',
    label: '🤖 Auto-Roll',
    description: 'Automatically rolls for you.',
    baseCost: 500,
    costMult: 1, // one-time unlock; cost never changes
    maxLevel: 1,
  },
  bonusMultiplier: {
    id: 'bonusMultiplier',
    label: '✨ Bonus Multiplier',
    description: 'Multiplies value gained from Rare+ drops.',
    baseCost: 300,
    costMult: 3.5,
    maxLevel: 10,
  },
};

// ---------------------------------------------------------------------------
// Default player state
// ---------------------------------------------------------------------------
function createDefaultState() {
  return {
    currency: 0,
    totalEarned: 0, // lifetime currency accumulated (for stats)
    upgrades: {
      luck: 0,
      multiRoll: 0,
      rollSpeed: 0,
      autoRoll: 0,
      bonusMultiplier: 0,
    },
  };
}

// ---------------------------------------------------------------------------
// PlayerState class
// ---------------------------------------------------------------------------
class PlayerState {
  constructor(savedData = null) {
    const base = createDefaultState();
    if (savedData) {
      this.currency = savedData.currency ?? base.currency;
      this.totalEarned = savedData.totalEarned ?? base.totalEarned;
      this.upgrades = { ...base.upgrades, ...savedData.upgrades };
    } else {
      this.currency = base.currency;
      this.totalEarned = base.totalEarned;
      this.upgrades = { ...base.upgrades };
    }
  }

  // ---- Currency ----------------------------------------------------------

  /** Add currency (e.g. from a roll or sell). */
  earn(amount) {
    this.currency += amount;
    this.totalEarned += amount;
  }

  /** Spend currency.  Returns true if successful, false if insufficient. */
  spend(amount) {
    if (this.currency < amount) return false;
    this.currency -= amount;
    return true;
  }

  // ---- Upgrades ----------------------------------------------------------

  /**
   * Calculate the cost of the next level of an upgrade.
   *
   * @param {string} id – upgrade id
   * @returns {number|null} cost, or null if already max level
   */
  getUpgradeCost(id) {
    const def = UPGRADE_DEFS[id];
    const level = this.upgrades[id];
    if (def.maxLevel !== null && level >= def.maxLevel) return null;
    return Math.ceil(def.baseCost * Math.pow(def.costMult, level));
  }

  /**
   * Attempt to purchase an upgrade level.
   *
   * @param {string} id
   * @returns {boolean} true if the purchase succeeded
   */
  buyUpgrade(id) {
    const cost = this.getUpgradeCost(id);
    if (cost === null) return false; // already max
    if (!this.spend(cost)) return false;
    this.upgrades[id]++;
    return true;
  }

  // ---- Derived stats -----------------------------------------------------

  /** How many rolls happen per click. */
  get rollsPerClick() {
    return 1 + this.upgrades.multiRoll;
  }

  /** Current cooldown between rolls in milliseconds. */
  get rollCooldownMs() {
    // Base cooldown 1000 ms; each Roll Speed level cuts it by 10%
    return Math.round(1000 * Math.pow(0.9, this.upgrades.rollSpeed));
  }

  /** Whether auto-roll is unlocked. */
  get autoRollActive() {
    return this.upgrades.autoRoll >= 1;
  }

  /** Bonus multiplier on item value (applied to Rare and above). */
  get bonusMultiplier() {
    return 1 + this.upgrades.bonusMultiplier * 0.25; // +25% per level
  }

  // ---- Serialisation -----------------------------------------------------

  toJSON() {
    return {
      currency: this.currency,
      totalEarned: this.totalEarned,
      upgrades: { ...this.upgrades },
    };
  }
}

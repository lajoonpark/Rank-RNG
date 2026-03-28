/**
 * rng.js — RNG System
 *
 * Defines all rank tiers with their base weights and values.
 * Provides a weighted-random roll function that respects the
 * player's current luck level.
 */

// ---------------------------------------------------------------------------
// Rank definitions
// Each rank has:
//   id       – unique string key
//   name     – display name
//   weight   – base drop weight (higher = more common)
//   value    – currency value when sold / added to inventory worth
//   color    – CSS colour used in the UI
//   emoji    – decorative icon shown next to the rank name
// ---------------------------------------------------------------------------
const RANKS = [
  {
    id: 'common',
    name: 'Common',
    weight: 4500,
    value: 1,
    color: '#9e9e9e',
    emoji: '⚪',
  },
  {
    id: 'uncommon',
    name: 'Uncommon',
    weight: 2500,
    value: 3,
    color: '#4caf50',
    emoji: '🟢',
  },
  {
    id: 'rare',
    name: 'Rare',
    weight: 1500,
    value: 10,
    color: '#2196f3',
    emoji: '🔵',
  },
  {
    id: 'epic',
    name: 'Epic',
    weight: 800,
    value: 35,
    color: '#9c27b0',
    emoji: '🟣',
  },
  {
    id: 'legendary',
    name: 'Legendary',
    weight: 400,
    value: 100,
    color: '#ff9800',
    emoji: '🟠',
  },
  {
    id: 'mythic',
    name: 'Mythic',
    weight: 200,
    value: 300,
    color: '#f44336',
    emoji: '🔴',
  },
  {
    id: 'ruler',
    name: 'Ruler',
    weight: 80,
    value: 1000,
    color: '#ffd700',
    emoji: '👑',
  },
  {
    id: 'overlord',
    name: 'Overlord',
    weight: 20,
    value: 5000,
    color: '#ff00ff',
    emoji: '💎',
  },
];

// Total base weight (10 000) — used for percentage calculations
const BASE_TOTAL_WEIGHT = RANKS.reduce((sum, r) => sum + r.weight, 0);

// ---------------------------------------------------------------------------
// Luck scaling
//
// Each luck level redistributes weight from the bottom two tiers toward the
// top tiers.  The transfer amount per level is capped so the system never
// breaks (i.e. common weight can never go below a small floor).
// ---------------------------------------------------------------------------
const LUCK_TRANSFER_PER_LEVEL = 80; // weight units moved per luck level
const COMMON_WEIGHT_FLOOR = 500;     // minimum weight kept on Common
const UNCOMMON_WEIGHT_FLOOR = 200;   // minimum weight kept on Uncommon

/**
 * Build an adjusted weight array for the given luck level.
 *
 * @param {number} luckLevel – current player luck level (0 = base)
 * @returns {number[]} array of weights parallel to RANKS
 */
function buildWeights(luckLevel) {
  const weights = RANKS.map((r) => r.weight);

  for (let i = 0; i < luckLevel; i++) {
    // Take weight from Common first, then Uncommon
    let transfer = LUCK_TRANSFER_PER_LEVEL;

    const commonAvail = Math.max(0, weights[0] - COMMON_WEIGHT_FLOOR);
    const fromCommon = Math.min(transfer, commonAvail);
    weights[0] -= fromCommon;
    transfer -= fromCommon;

    if (transfer > 0) {
      const uncommonAvail = Math.max(0, weights[1] - UNCOMMON_WEIGHT_FLOOR);
      const fromUncommon = Math.min(transfer, uncommonAvail);
      weights[1] -= fromUncommon;
      transfer -= fromUncommon;
    }

    // Distribute the transferred weight across tiers Rare–Overlord
    // using a simple proportional spread (more goes to mid tiers so it
    // feels rewarding without immediately flooding Overlord).
    const higherTierWeights = [6, 5, 4, 3, 2, 1]; // Rare→Overlord relative share
    const higherTotal = higherTierWeights.reduce((a, b) => a + b, 0);
    const moved = LUCK_TRANSFER_PER_LEVEL - transfer; // how much was actually taken
    higherTierWeights.forEach((share, idx) => {
      weights[2 + idx] += Math.round((moved * share) / higherTotal);
    });
  }

  return weights;
}

/**
 * Perform a single weighted-random roll.
 *
 * @param {number} luckLevel – current player luck level
 * @returns {object} the rank object that was rolled (from RANKS)
 */
function rollRank(luckLevel = 0) {
  const weights = buildWeights(luckLevel);
  const total = weights.reduce((a, b) => a + b, 0);
  let roll = Math.random() * total;

  for (let i = 0; i < RANKS.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return RANKS[i];
  }

  // Fallback (floating-point edge case)
  return RANKS[0];
}

/**
 * Calculate the effective drop-chance percentage for every rank
 * at the given luck level.  Used by the UI to show odds.
 *
 * @param {number} luckLevel
 * @returns {{ id: string, chance: number }[]}
 */
function getDropChances(luckLevel = 0) {
  const weights = buildWeights(luckLevel);
  const total = weights.reduce((a, b) => a + b, 0);
  return RANKS.map((rank, i) => ({
    id: rank.id,
    chance: (weights[i] / total) * 100,
  }));
}

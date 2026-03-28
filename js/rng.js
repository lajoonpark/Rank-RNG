/**
 * rng.js — RNG System
 *
 * Defines all 18 rank tiers with base drop chances and values.
 * Provides a weighted-random roll function that respects the
 * player's current luck level.
 *
 * Key concepts:
 *   baseChance  – raw percentage weight (all tiers sum to ~100%)
 *   rarityLevel – integer 1 (common) → 18 (rarest); drives luck scaling
 *   color       – hex code OR special keyword: gradient | rainbow | blackhole | glitch
 *
 * Luck formula (applied before normalization):
 *   adjustedChance = baseChance * (1 + luck * rarityLevel * 0.02)
 *
 * Because every rank gets boosted—but higher-rarity ranks get a larger
 * multiplier—normalization automatically compresses lower-tier shares
 * without ever sending any weight negative.
 */

// ---------------------------------------------------------------------------
// Rank definitions
// Each rank has:
//   id          – unique string key
//   name        – display name
//   baseChance  – base drop percentage weight
//   value       – currency value added to inventory / earned on roll
//   color       – CSS colour (hex) or special-effect keyword
//   rarityLevel – integer (1 = most common, 18 = rarest)
//   emoji       – decorative icon shown next to the rank name
// ---------------------------------------------------------------------------
const RANKS = [
  { id: 'common',          name: 'Common',          baseChance: 40,     value: 1,            color: '#9E9E9E',   rarityLevel: 1,  emoji: '⚪' },
  { id: 'basic',           name: 'Basic',            baseChance: 25,     value: 2,            color: '#BDBDBD',   rarityLevel: 2,  emoji: '🔘' },
  { id: 'uncommon',        name: 'Uncommon',         baseChance: 15,     value: 5,            color: '#4CAF50',   rarityLevel: 3,  emoji: '🟢' },
  { id: 'rare',            name: 'Rare',             baseChance: 8,      value: 15,           color: '#2196F3',   rarityLevel: 4,  emoji: '🔵' },
  { id: 'epic',            name: 'Epic',             baseChance: 5,      value: 50,           color: '#9C27B0',   rarityLevel: 5,  emoji: '🟣' },
  { id: 'legendary',       name: 'Legendary',        baseChance: 3,      value: 150,          color: '#FF9800',   rarityLevel: 6,  emoji: '🟠' },
  { id: 'mythic',          name: 'Mythic',           baseChance: 2,      value: 500,          color: '#F44336',   rarityLevel: 7,  emoji: '🔴' },
  { id: 'ascended',        name: 'Ascended',         baseChance: 1,      value: 2000,         color: '#E91E63',   rarityLevel: 8,  emoji: '✨' },
  { id: 'immortal',        name: 'Immortal',         baseChance: 0.5,    value: 10000,        color: '#FFD700',   rarityLevel: 9,  emoji: '💫' },
  { id: 'eternal',         name: 'Eternal',          baseChance: 0.2,    value: 50000,        color: '#00E5FF',   rarityLevel: 10, emoji: '🌊' },
  { id: 'celestial',       name: 'Celestial',        baseChance: 0.1,    value: 250000,       color: '#FFFFFF',   rarityLevel: 11, emoji: '⭐' },
  { id: 'transcendent',    name: 'Transcendent',     baseChance: 0.05,   value: 1000000,      color: '#7C4DFF',   rarityLevel: 12, emoji: '🔮' },
  { id: 'ruler',           name: 'Ruler',            baseChance: 0.02,   value: 5000000,      color: '#C6A700',   rarityLevel: 13, emoji: '👑' },
  { id: 'overlord',        name: 'Overlord',         baseChance: 0.01,   value: 25000000,     color: '#FF1744',   rarityLevel: 14, emoji: '💎' },
  { id: 'cosmic',          name: 'Cosmic',           baseChance: 0.005,  value: 100000000,    color: 'gradient',  rarityLevel: 15, emoji: '🌌' },
  { id: 'infinity',        name: 'Infinity',         baseChance: 0.001,  value: 1000000000,   color: 'rainbow',   rarityLevel: 16, emoji: '♾️' },
  { id: 'singularity',     name: 'Singularity',      baseChance: 0.0005, value: 5000000000,   color: 'blackhole', rarityLevel: 17, emoji: '🕳️' },
  { id: 'reality_breaker', name: 'Reality Breaker',  baseChance: 0.0001, value: 50000000000,  color: 'glitch',    rarityLevel: 18, emoji: '⚡' },
];

// ---------------------------------------------------------------------------
// Luck-adjusted chance calculation
//
// Formula: adjustedChance = baseChance * (1 + luck * rarityLevel * 0.02)
//
//   luck = 0  → every rank keeps its baseChance exactly
//   luck > 0  → every rank scales up, but higher rarityLevel ranks scale MORE
//
// After applying the multiplier we normalize all values so they sum to 100%.
// Normalization is what actually compresses lower-tier shares — no weight
// ever goes negative, keeping the system stable at any luck level.
// ---------------------------------------------------------------------------

/**
 * Compute normalized drop chances for all ranks at the given luck level.
 *
 * @param {number} luck – player luck level (0 = base, higher = more rare drops)
 * @returns {{ id: string, chance: number }[]} per-rank chance percentages summing to 100
 */
function buildAdjustedChances(luck) {
  // Step 1: Apply luck multiplier — higher rarityLevel gets a larger boost
  const adjusted = RANKS.map((r) => ({
    id: r.id,
    raw: r.baseChance * (1 + luck * r.rarityLevel * 0.02),
  }));

  // Step 2: Normalize so all chances sum back to 100%
  const total = adjusted.reduce((sum, a) => sum + a.raw, 0);
  return adjusted.map((a) => ({
    id: a.id,
    chance: (a.raw / total) * 100,
  }));
}

/**
 * Perform a single weighted-random roll using luck-adjusted chances.
 *
 * @param {number} luck – current player luck level
 * @returns {object} the rank object that was rolled (from RANKS)
 */
function rollItem(luck = 0) {
  const chances = buildAdjustedChances(luck);

  // Pick a random point in [0, 100) and walk the cumulative distribution
  let roll = Math.random() * 100;
  for (let i = 0; i < chances.length; i++) {
    roll -= chances[i].chance;
    if (roll <= 0) return RANKS[i];
  }

  // Floating-point safety fallback
  return RANKS[0];
}

// Backward-compatible alias used by existing game.js call sites
const rollRank = rollItem;

/**
 * Return the effective drop-chance percentage for every rank at the given luck.
 * Used by the UI to populate the odds table.
 *
 * @param {number} luck
 * @returns {{ id: string, chance: number }[]}
 */
function getDropChances(luck = 0) {
  return buildAdjustedChances(luck);
}

// ---------------------------------------------------------------------------
// Debug mode — simulate N rolls and log distribution to the console
// ---------------------------------------------------------------------------

/**
 * Run a simulation of `count` rolls and log the distribution to the console.
 * Useful for verifying RNG balance.
 *
 * Usage: debugRollSimulation()              // 100 000 rolls at luck 0
 *        debugRollSimulation(500000, 10)    // 500 000 rolls at luck 10
 *
 * This function is available on the global scope (browser console):
 *   > debugRollSimulation(100000, 5)
 *
 * @param {number} count – number of rolls to simulate (default 100 000)
 * @param {number} luck  – luck level to test (default 0)
 */
function debugRollSimulation(count = 100_000, luck = 0) {
  console.group(`🎲 Roll Simulation — ${count.toLocaleString()} rolls (luck=${luck})`);

  const tally = {};
  RANKS.forEach((r) => (tally[r.id] = 0));
  for (let i = 0; i < count; i++) {
    tally[rollItem(luck).id]++;
  }

  const chances = getDropChances(luck);
  console.log('Rank                  Expected%    Actual%     Ratio');
  RANKS.slice()
    .reverse()
    .forEach((rank) => {
      const expected = chances.find((c) => c.id === rank.id).chance;
      const actual = (tally[rank.id] / count) * 100;
      const ratio = expected > 0 ? (actual / expected).toFixed(3) : '—';
      console.log(
        `${rank.name.padEnd(22)}${expected.toFixed(4).padStart(10)}%  ` +
        `${actual.toFixed(4).padStart(10)}%  ${ratio.toString().padStart(8)}`
      );
    });

  console.groupEnd();
}

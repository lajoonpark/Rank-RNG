/**
 * pity.js — Pity System
 *
 * Tracks cumulative roll progress toward a guaranteed rank reward.
 * When the player's total rolls toward the chosen target rank reach
 * the configured threshold, exactly ONE guaranteed copy of that rank
 * is injected into the roll result — even during a multi-roll batch.
 *
 * Key design rules:
 *   • All roll types (single, multi, auto) count toward pity progress.
 *   • Only ONE pity reward is granted per processRolls() call, regardless
 *     of batch size.
 *   • Per-rank progress is stored independently so switching targets
 *     does not lose accumulated progress.
 *   • If the player naturally rolls the target rank (without pity firing),
 *     that rank's pity counter resets to 0.
 *   • After pity fires, progress is set to the overflow amount so any
 *     extra rolls in that batch carry forward into the next pity cycle.
 */

// ---------------------------------------------------------------------------
// Pity-eligible rank configuration
// Thresholds are intentionally easy to adjust — change the numbers here.
// ---------------------------------------------------------------------------
const PITY_CONFIG = [
  { id: 'overlord',        name: 'Overlord',       emoji: '💎', threshold: 500  },
  { id: 'cosmic',          name: 'Cosmic',          emoji: '🌌', threshold: 1000 },
  { id: 'infinity',        name: 'Infinity',        emoji: '♾️', threshold: 2000 },
  { id: 'singularity',     name: 'Singularity',     emoji: '🕳️', threshold: 3500 },
  { id: 'reality_breaker', name: 'Reality Breaker', emoji: '⚡', threshold: 5000 },
];

// ---------------------------------------------------------------------------
// PitySystem class
// ---------------------------------------------------------------------------
class PitySystem {
  /**
   * @param {object|null} savedData – serialised state from toJSON(), or null
   */
  constructor(savedData = null) {
    /** Active target rank ID, or null when no target is selected. */
    this.targetId = null;

    /** Per-rank roll-progress counters (keyed by rank ID). */
    this.progress = {};
    PITY_CONFIG.forEach((c) => { this.progress[c.id] = 0; });

    /**
     * Re-entrant call guard.  JavaScript is single-threaded, so this is
     * a pure-safety mechanism against unexpected re-entrant invocations.
     */
    this._processing = false;

    if (savedData) {
      // Restore active target (validate it is still a known rank)
      if (savedData.targetId && PITY_CONFIG.find((c) => c.id === savedData.targetId)) {
        this.targetId = savedData.targetId;
      }

      // Restore per-rank progress, defaulting missing entries to 0
      if (savedData.progress && typeof savedData.progress === 'object') {
        PITY_CONFIG.forEach((c) => {
          const saved = savedData.progress[c.id];
          this.progress[c.id] = (typeof saved === 'number' && saved >= 0) ? saved : 0;
        });
      }
    }
  }

  // ---- Queries -------------------------------------------------------------

  /** @returns {object|null} PITY_CONFIG entry for the active target, or null */
  getTargetConfig() {
    if (!this.targetId) return null;
    return PITY_CONFIG.find((c) => c.id === this.targetId) || null;
  }

  /** @returns {number} current progress for the active target (0 if none) */
  getTargetProgress() {
    if (!this.targetId) return 0;
    return this.progress[this.targetId] || 0;
  }

  // ---- Mutations -----------------------------------------------------------

  /**
   * Set the active pity target rank.
   * Pass null to deselect the current target.
   *
   * @param {string|null} id – rank ID from PITY_CONFIG, or null
   */
  setTarget(id) {
    if (id === null || PITY_CONFIG.find((c) => c.id === id)) {
      this.targetId = id;
    }
  }

  // ---- Core roll processing ------------------------------------------------

  /**
   * Process a batch of rolls, honouring the active pity target.
   *
   * Behaviour:
   *   1. All `count` rolls are resolved via the normal RNG (rollItem).
   *   2. If the pity threshold is crossed during this batch, the roll slot
   *      where the threshold would be reached is overridden with the
   *      guaranteed target rank — exactly one time per call.
   *   3. If pity does NOT fire and a natural roll hits the target rank,
   *      that rank's pity counter is reset to 0.
   *   4. After processing, pity progress is updated correctly:
   *      - Pity fired  → progress = (savedProgress + count) − threshold  (overflow)
   *      - Natural hit → progress reset to 0
   *      - Otherwise   → progress += count
   *
   * @param {number} count       – number of rolls in this batch (≥ 1)
   * @param {number} luck        – player's current luck level
   * @param {object} [areaBoosts={}] – rank boost multipliers from the active area
   * @returns {{ rank: object, isPityReward: boolean }[]} one entry per roll
   */
  processRolls(count, luck, areaBoosts = {}) {
    if (this._processing) {
      // Safety fallback: should never happen in normal single-threaded execution
      return Array.from({ length: count }, () => ({ rank: rollItem(luck, areaBoosts), isPityReward: false }));
    }

    this._processing = true;
    try {
      return this._doProcessRolls(count, luck, areaBoosts);
    } finally {
      this._processing = false;
    }
  }

  /** @private */
  _doProcessRolls(count, luck, areaBoosts = {}) {
    const config = this.getTargetConfig();

    // ---- No target: normal rolls, no pity tracking ----
    if (!config) {
      return Array.from({ length: count }, () => ({ rank: rollItem(luck, areaBoosts), isPityReward: false }));
    }

    const savedProgress = this.progress[this.targetId];
    const threshold     = config.threshold;

    // Roll the entire batch through normal RNG first
    const rawRanks = Array.from({ length: count }, () => rollItem(luck, areaBoosts));

    // ---- Pity fires this batch ----
    if (savedProgress + count >= threshold) {
      // Find the first 0-based slot index where the cumulative count
      // meets the threshold.  This is guaranteed to be in [0, count-1].
      const pitySlot = Math.max(0, Math.min(threshold - savedProgress - 1, count - 1));

      // Inject the guaranteed target rank at that slot
      const targetRank = RANKS.find((r) => r.id === this.targetId);
      rawRanks[pitySlot] = targetRank;

      // Carry overflow forward into the next pity cycle
      this.progress[this.targetId] = Math.max(0, savedProgress + count - threshold);

      return rawRanks.map((r, i) => ({ rank: r, isPityReward: i === pitySlot }));
    }

    // ---- Pity does NOT fire ----
    // Check whether any natural roll happened to be the target rank
    const naturalHit = rawRanks.some((r) => r.id === this.targetId);
    if (naturalHit) {
      // Natural rank acquisition resets this rank's pity progress
      this.progress[this.targetId] = 0;
    } else {
      this.progress[this.targetId] = savedProgress + count;
    }

    return rawRanks.map((r) => ({ rank: r, isPityReward: false }));
  }

  // ---- Serialisation -------------------------------------------------------

  toJSON() {
    return {
      targetId: this.targetId,
      progress: { ...this.progress },
    };
  }
}

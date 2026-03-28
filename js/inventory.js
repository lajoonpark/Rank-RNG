/**
 * inventory.js — Inventory System
 *
 * Stores all rolled ranks, tracks quantities and cumulative value,
 * and supports selling items back for currency.
 */

class Inventory {
  constructor(savedData = null) {
    /**
     * items: { [rankId]: { rank: object, quantity: number, totalValue: number } }
     */
    this.items = {};

    if (savedData && savedData.items) {
      // Re-hydrate saved data; look up rank objects by id
      for (const [id, entry] of Object.entries(savedData.items)) {
        const rank = RANKS.find((r) => r.id === id);
        if (rank) {
          this.items[id] = {
            rank,
            quantity: entry.quantity,
            totalValue: entry.totalValue,
          };
        }
      }
    }
  }

  // ---- Mutators ----------------------------------------------------------

  /**
   * Add one instance of a rank to the inventory.
   *
   * @param {object} rank        – rank definition from RANKS
   * @param {number} valueEarned – actual value credited (may include bonus)
   */
  addRank(rank, valueEarned) {
    if (!this.items[rank.id]) {
      this.items[rank.id] = { rank, quantity: 0, totalValue: 0 };
    }
    this.items[rank.id].quantity++;
    this.items[rank.id].totalValue += valueEarned;
  }

  /**
   * Sell a specified quantity of a rank.
   * Returns the currency refunded (half the stored value, to keep balance).
   *
   * @param {string} rankId
   * @param {number} qty
   * @returns {number} currency refunded
   */
  sellRank(rankId, qty = 1) {
    const entry = this.items[rankId];
    if (!entry || entry.quantity < qty) return 0;

    // Sell at 50 % of the average stored value per unit
    const avgValue = entry.totalValue / entry.quantity;
    const refund = Math.floor(avgValue * qty * 0.5);

    entry.quantity -= qty;
    entry.totalValue -= avgValue * qty;

    if (entry.quantity <= 0) {
      delete this.items[rankId];
    }

    return refund;
  }

  /**
   * Sell ALL of a given rank.
   *
   * @param {string} rankId
   * @returns {number} currency refunded
   */
  sellAll(rankId) {
    const entry = this.items[rankId];
    if (!entry) return 0;
    return this.sellRank(rankId, entry.quantity);
  }

  // ---- Queries -----------------------------------------------------------

  /** Sum of all item values currently stored. */
  getTotalValue() {
    return Object.values(this.items).reduce(
      (sum, e) => sum + e.totalValue,
      0
    );
  }

  /** Total number of individual items across all ranks. */
  getTotalCount() {
    return Object.values(this.items).reduce(
      (sum, e) => sum + e.quantity,
      0
    );
  }

  /**
   * Return inventory entries sorted from rarest to most common
   * (based on RANKS order, reversed).
   */
  getSortedEntries() {
    return Object.values(this.items).sort((a, b) => {
      const idxA = RANKS.findIndex((r) => r.id === a.rank.id);
      const idxB = RANKS.findIndex((r) => r.id === b.rank.id);
      return idxB - idxA; // rarest first
    });
  }

  // ---- Serialisation -----------------------------------------------------

  toJSON() {
    const items = {};
    for (const [id, entry] of Object.entries(this.items)) {
      items[id] = {
        quantity: entry.quantity,
        totalValue: entry.totalValue,
      };
    }
    return { items };
  }
}

# Rank RNG — Incremental Game

A browser-based RNG incremental game where you roll for ranks, build an inventory, earn currency, and upgrade your luck.

## How to Run

No build step or server required — just open the file in your browser:

```bash
# Option 1: open directly
open index.html

# Option 2: serve locally (avoids any browser file-access restrictions)
npx serve .
# or
python3 -m http.server 8080
```

Then visit `http://localhost:8080` (if using a local server).

## Game Overview

| Feature | Details |
|---|---|
| **Ranks** | Common → Uncommon → Rare → Epic → Legendary → Mythic → Ruler → Overlord |
| **Currency** | Earned on every roll and by selling inventory items |
| **Upgrades** | Luck, Multi-Roll, Roll Speed, Auto-Roll, Bonus Multiplier |
| **Save / Load** | Auto-saves every 30 s via `localStorage`; manual save button also available |

## Project Structure

```
index.html          Main game page
css/
  style.css         Dark-theme UI styling with rank colour accents
js/
  rng.js            Weighted-random RNG system and rank definitions
  player.js         Player state: currency, upgrade levels, derived stats
  inventory.js      Inventory tracking (quantities, values, sell logic)
  ui.js             All DOM rendering functions
  game.js           Game loop, event wiring, save/load orchestration
```

## Rank Drop Chances (base, no luck upgrades)

| Rank | Base Chance | Value |
|---|---|---|
| Common | 45 % | 1 |
| Uncommon | 25 % | 3 |
| Rare | 15 % | 10 |
| Epic | 8 % | 35 |
| Legendary | 4 % | 100 |
| Mythic | 2 % | 300 |
| Ruler | 0.8 % | 1 000 |
| Overlord | 0.2 % | 5 000 |

Each **Luck** upgrade shifts weight away from Common/Uncommon toward higher tiers.

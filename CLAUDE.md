# PokerBot — Claude Code Context

## Project Overview
Python-based poker bot using CFR (Counterfactual Regret Minimization) to train optimal strategies, plus a React web app for playing against the trained bots. Components:
1. **Game engines (Python):** Kuhn Poker, Leduc Poker, NL Hold'em simulations
2. **Bot intelligence (Python):** CFR, External-Sampling MCCFR (with CFR+ clipping and DCFR discounting), exact exploitability for Kuhn/Leduc
3. **Web app (`web/`):** React + TypeScript + Vite; PvB / PvP / BvB play for Kuhn, Leduc, and heads-up Limit Hold'em, deployed to GitHub Pages from `docs/`

## Project Structure
```
src/
├── algorithms/      # cfr.py, mccfr.py, info_set.py, exploitability.py
├── evaluation/      # thin re-export of algorithms.exploitability
├── simulation/      # Playable engines (kuhn_poker.py, nl_holdem.py; leduc/limit are stubs)
├── training/        # Game rules for training (kuhn_poker.py, leduc_poker.py, limit_poker.py)
└── utils/           # cards.py, player.py, equity.py (bucketing + preflop table)
web/
├── src/engines/     # TS game engines (kuhn, leduc, limit_holdem, hand_eval, equity)
├── src/bots/        # mccfr.ts (strategy lookup + info-set key builder), legality.ts
├── src/stores/      # zustand game/ui stores
└── public/models/   # trained strategy JSONs (source of truth; docs/ is the build output)
```

## Environment
- Python venv at `.venv/` — activate: `source .venv/bin/activate`
- `pip install -r requirements.txt` (phevaluator, pytest)
- Web: `cd web && npm install`

## Key Contracts (do not break)
- **Info-set key grammar** is shared between `src/training/limit_poker.py` (docstring documents it) and `web/src/bots/mccfr.ts` (`buildActionHistory`). Preflop: F/C/R with BB option P (limp-check = "CP"); postflop: P/B/C/R/F; `//` appended at every round completion (start-of-street keys end in `//`). Limit keys are `b{bucket}:{history}` with 20 buckets.
- `web/src/engines/__tests__/golden_keys.test.ts` enforces this contract — every key the web engine generates must exist in the exported model JSONs.
- Payoffs in training rules are always from player 0's perspective. In limit, player 1 = SB/button (acts first preflop), player 0 = BB.
- The web preflop_equity.json must stay identical to data/preflop_equity.pkl (export_limit.py re-syncs it).

## Testing
```bash
python -m pytest tests/ -q          # Python: CFR convergence, exploitability, game rules, NLHE engine
cd web && npx vitest run            # Web: engines, bots, golden keys, hand eval, smoke
cd web && npx tsc -b && npx eslint src
```

## Training / Export
```bash
source .venv/bin/activate
python -m src.training.kuhn_poker    # Kuhn Poker CFR
python -m src.training.leduc_poker   # Leduc Poker CFR
python export_strategies.py          # exports kuhn/leduc/limit strategy JSONs
python export_limit.py               # trains + exports MCCFR/MCCFR_plus/DCFR limit models (LIMIT_ITERS env var)
cd web && npm run build              # rebuilds docs/ (GitHub Pages) from web/, includes public/models
```

## Current Status
- CFR converges on Kuhn (tests assert equilibrium invariants + exploitability < 0.01)
- Exact per-info-set best-response exploitability implemented for Kuhn/Leduc
- ES-MCCFR with correct opponent-node strategy averaging; CFR+ clip and DCFR discounting options
- Heads-up Limit Hold'em trainer uses real blinds (F/C/R preflop) matching the web engine
- NL Hold'em simulation: correct betting rounds, side pots, all-ins, HU blinds (tested)
- `src/simulation/leduc_poker.py` and `limit_holdem.py` are intentional NotImplementedError stubs

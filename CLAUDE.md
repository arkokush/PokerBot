# PokerBot — Claude Code Context

## Project Overview
Python-based poker bot using CFR (Counterfactual Regret Minimization) to train optimal strategies. Built in two phases:
1. **Phase 1 (done):** Game engine — Texas Hold'em, Kuhn Poker, Leduc Poker
2. **Phase 2 (next):** Bot intelligence — Monte Carlo CFR, strategy evaluation, opponent modeling

## Project Structure
```
src/
├── algorithms/      # CFR training algorithms (cfr.py, info_set.py)
├── evaluation/      # Exploitability and head-to-head evaluation
├── simulation/      # Game runners (kuhn_poker.py, leduc_poker.py, nl_holdem.py, limit_holdem.py)
├── training/        # Training entry points (kuhn_poker.py, leduc_poker.py)
└── utils/           # Cards, deck, player, agent base classes
```

## Environment
- Python 3.12, virtual environment at `.venv/`
- Activate: `source .venv/bin/activate`
- Dependencies: `phevaluator` (hand evaluation)
- No test framework set up yet

## Key Abstractions
- `Agent` (utils/player.py): Abstract base — subclass and implement `decide(state)` to create a bot
- `CFR` (algorithms/cfr.py): Generic CFR implementation
- `InformationSet` (algorithms/info_set.py): Stores regret and strategy data per info set
- Game simulations in `src/simulation/` are separate from training entry points in `src/training/`

## Current Status
- CFR algorithm implemented and working for Kuhn Poker
- Leduc Poker simulation and training recently completed (modified files: `algorithms/cfr.py`, `training/leduc_poker.py`)
- NL Hold'em game engine complete but no CFR training for it yet
- No MCCFR, CFR+, or exploitability calculations implemented yet

## Running Training
```bash
source .venv/bin/activate
python -m src.training.kuhn_poker    # Kuhn Poker CFR
python -m src.training.leduc_poker   # Leduc Poker CFR
```

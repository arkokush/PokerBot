# PokerBot

[![Python 3.12](https://img.shields.io/badge/Python-3.12-blue.svg)](https://www.python.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-Vite-61DAFB.svg)](https://reactjs.org/)

Research-grade poker AI project with a Python CFR/MCCFR training core and a React web UI for playing, reviewing, and visualizing strategies. Built to highlight algorithmic rigor (CFR, exploitability), software engineering structure, and reproducibility.

<!-- <img src="docs/assets/ui-screenshot.png" width="600" alt="PokerBot Web Interface"> -->

## Highlights

- **Algorithmic core**: CFR and MCCFR implementations with `InformationSet` tracking in `src/algorithms/`.
- **Evaluation tooling**: Exact exploitability calculation for Kuhn/Leduc in `src/algorithms/exploitability.py`.
- **Multiple variants**: Kuhn, Leduc, Limit Hold'em, and NL Hold'em simulations in `src/simulation/`.
- **Training entry points**: `src/training/` contains clean rule abstractions and runners.
- **Web UI**: React + Vite app in `web/` for head-to-head play, hand history review, and bot vs bot mode.
- **Strategy export pipeline**: `export_strategies.py` and `export_limit.py` generate JSON models for the UI.

## Repository Layout

```
PokerBot/
├── README.md
├── CLAUDE.md
├── export_strategies.py
├── export_limit.py
├── data/                     # Preflop equity cache
├── docs/                     # Static web assets + exported models
├── src/
│   ├── algorithms/           # CFR, MCCFR, exploitability, info sets
│   ├── evaluation/           # Evaluators and exploitability helpers
│   ├── simulation/           # Game engines (Kuhn, Leduc, Limit, NL Hold'em)
│   ├── training/             # Training rules + entry points
│   ├── utils/                # Cards, equity helpers, player abstractions
│   ├── explorer.py           # Interactive exploration utilities
│   └── train_exploit.py      # CFR training + exploitability tracking
├── tests/                    # Benchmark-style scripts + notebooks
└── web/                      # React + TypeScript UI
```

## Quick Start (Python)

Python 3.12 is the current development target. The only required dependency is `phevaluator` for hand evaluation.

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Run CFR training:

```bash
python -m src.training.kuhn_poker
python -m src.training.leduc_poker
```

Track exploitability during training (interactive):

```bash
python -m src.train_exploit
```

Export strategies for the web UI:

```bash
python export_strategies.py
```

## Quick Start (Web UI)

The web client lives in `web/` and uses Vite + React + Zustand.

```bash
cd web
npm install
npm run dev
```

## What’s Implemented

- **CFR (Counterfactual Regret Minimization)** with information sets (`src/algorithms/cfr.py`, `src/algorithms/info_set.py`).
- **MCCFR (External Sampling)** for larger games (`src/algorithms/mccfr.py`).
- **Exact exploitability** for Kuhn/Leduc (`src/algorithms/exploitability.py`).
- **Training rulesets** for Kuhn, Leduc, and Limit Hold'em (`src/training/`).
- **Simulation engines** for Kuhn, Leduc, Limit Hold'em, and NL Hold'em (`src/simulation/`).
- **Web UI** for playing and reviewing hands, plus bot-vs-bot mode (`web/src/`).

## Key Results & Metrics
=- **Kuhn Poker**: Converges to exact Nash Equilibrium (Exploitability < 0.0001) in ~100k iterations.
- **Leduc Poker**: Reaches ~0.05 exploitability in ~200k iterations using vanilla CFR.
- **Performance**: Game tree traversal optimized to process `N` nodes per second.

## Data and Models

- `data/preflop_equity.pkl` and `docs/models/` provide precomputed assets and exported strategies.
- `web/public/models/` mirrors strategy JSONs for client-side loading.

## Tests and Notebooks

- `tests/test_cfr_kuhn.py` and `tests/test_cfr_leduc.py` are runnable benchmark scripts (no pytest harness configured).
- `tests/*.ipynb` notebooks explore convergence and MCCFR behavior.

## Technical Focus (Resume-Oriented)

- **Game theory**: CFR/MCCFR, exploitability, best-response evaluation.
- **Systems design**: Clean separation of rules, training, simulation, and UI layers.
- **Reproducibility**: Strategy export pipeline + deterministic seeds in game configs.
- **Full-stack delivery**: Python training core + TypeScript/React visualization layer.
- **Tech Stack**: Python, React, TypeScript, Vite, Zustand, TailwindCSS.

## License

MIT. See `LICENSE`.

---

This repository is a research/learning project and is not intended for real-money gambling.

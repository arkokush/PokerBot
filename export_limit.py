"""Train and export the heads-up Limit Hold'em models used by the web UI.

Trains three MCCFR variants on the real-blinds limit hold'em game defined
in src/training/limit_poker.py and writes them where the web app loads them
(web/public/models). It also re-exports the preflop equity table from
data/preflop_equity.pkl as JSON so the web bot buckets preflop hands with
EXACTLY the same numbers the trainer used — a mismatched table can put
borderline hands in different buckets on the two sides.

Usage:
    python export_limit.py               # default iterations
    LIMIT_ITERS=50000 python export_limit.py
"""
import json
import os
import time

from src.algorithms.mccfr import MCCFR
from src.training.limit_poker import LimitPokerRules
from src.utils.equity import load_preflop_equity

ITERATIONS = int(os.environ.get("LIMIT_ITERS", "200000"))
OUT_DIR = "web/public/models"

# DCFR parameters per Brown & Sandholm (2019): alpha=1.5, beta=0, gamma=2.
VARIANTS = {
    "MCCFR": {},
    "MCCFR_plus": {"clip": True},
    "DCFR": {"alpha": 1.5, "beta": 0.0, "gamma": 2.0},
}

os.makedirs(OUT_DIR, exist_ok=True)

for name, kwargs in VARIANTS.items():
    print(f"Training {name} ({ITERATIONS:,} MCCFR iterations)...")
    start = time.time()
    trainer = MCCFR(LimitPokerRules(), **kwargs)
    trainer.train(ITERATIONS)
    strategy = trainer.get_strategy()

    game = LimitPokerRules()
    export = {}
    for key, probs in strategy.items():
        history = key.split(":", 1)[1]
        actions = game.get_legal_actions(history)
        if len(actions) == 1 and actions[0] == "//":
            continue
        export[key] = {"actions": actions, "probs": [round(p, 6) for p in probs]}

    path = os.path.join(OUT_DIR, f"{name}.json")
    with open(path, "w") as f:
        json.dump(export, f)
    print(f"  {name}: {len(export)} info sets -> {path} "
          f"({time.time() - start:.0f}s)", flush=True)

# Keep the web's preflop equity table identical to the trainer's.
table = load_preflop_equity()
with open(os.path.join(OUT_DIR, "preflop_equity.json"), "w") as f:
    json.dump({k: round(v, 6) for k, v in table.items()}, f)
print(f"  preflop_equity.json refreshed ({len(table)} hands)")

print("Done!")

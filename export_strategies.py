"""Export trained CFR strategies as JSON for the web UI."""
import json
import os

from src.algorithms.cfr import CFR
from src.algorithms.mccfr import MCCFR
from src.training.kuhn_poker import KuhnPokerRules
from src.training.leduc_poker import LeducPokerRules
from src.training.limit_poker import LimitPokerRules

os.makedirs("docs/models", exist_ok=True)

# --- Kuhn Poker ---
print("Training Kuhn Poker (100k iterations)...")
kuhn = CFR(KuhnPokerRules())
kuhn.train(100_000)
strategy = kuhn.get_strategy()
# Include action labels per info set
kuhn_export = {}
for key, probs in strategy.items():
    kuhn_export[key] = {"actions": ["P", "B"], "probs": [round(p, 6) for p in probs]}
with open("docs/models/kuhn_strategy.json", "w") as f:
    json.dump(kuhn_export, f, indent=2)
print(f"  Exported {len(kuhn_export)} info sets")

# --- Leduc Poker ---
print("Training Leduc Poker (200k iterations)...")
leduc = CFR(LeducPokerRules())
leduc.train(200_000)
strategy = leduc.get_strategy()
leduc_game = LeducPokerRules()
leduc_export = {}
for key, probs in strategy.items():
    # Reconstruct which actions this info set had
    history = key.split(":", 1)[1]
    actions = leduc_game.get_legal_actions(history)
    # Filter to only real action nodes (not forced transitions)
    if len(actions) == 1 and actions[0] == "//":
        continue
    leduc_export[key] = {"actions": actions, "probs": [round(p, 6) for p in probs]}
with open("docs/models/leduc_strategy.json", "w") as f:
    json.dump(leduc_export, f, indent=2)
print(f"  Exported {len(leduc_export)} info sets")

# --- Limit Hold'em ---
print("Training Limit Hold'em (5k MCCFR iterations)...")
limit = MCCFR(LimitPokerRules())
limit.train(5_000)
strategy = limit.get_strategy()
limit_game = LimitPokerRules()
limit_export = {}
for key, probs in strategy.items():
    history = key.split(":", 1)[1]
    actions = limit_game.get_legal_actions(history)
    if len(actions) == 1 and actions[0] == "//":
        continue
    limit_export[key] = {"actions": actions, "probs": [round(p, 6) for p in probs]}
with open("docs/models/limit_strategy.json", "w") as f:
    json.dump(limit_export, f, indent=2)
print(f"  Exported {len(limit_export)} info sets")

print("Done! Strategies exported to docs/models/")

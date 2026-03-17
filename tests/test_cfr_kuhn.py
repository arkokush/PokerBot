"""
Test CFR training on Kuhn Poker (KQJ).

Expected Nash equilibrium:
  P1 opening action:
    J:   ~67% Pass, ~33% Bet
    Q:   ~100% Pass, ~0% Bet
    K:   ~0% Pass, ~100% Bet

  P2 response if P1 Passed (history = P):
    J:P  ~33% Pass, ~67% Bet
    Q:P  ~100% Pass, ~0% Bet
    K:P  ~0% Pass, ~100% Bet

  P2 response if P1 Bet (history = B):
    J:B  ~100% Pass, ~0% Bet
    Q:B  ~67% Pass, ~33% Bet
    K:B  ~0% Pass, ~100% Bet

  P1 response if P1 Passed then P2 Bet (history = PB):
    J:PB ~100% Pass, ~0% Bet
    Q:PB ~67% Pass, ~33% Bet
    K:PB ~0% Pass, ~100% Bet
"""

import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from src.algorithms.cfr import CFR
from src.training.kuhn_poker import KuhnPokerRules

ITERATIONS = 1_000_000

# Expected Nash equilibrium values [Pass%, Bet%]
EXPECTED = {
    # P1 opening
    "J:":   [67, 33],
    "Q:":   [100, 0],
    "K:":   [0, 100],
    # P2 after P1 Pass
    "J:P":  [67, 33],
    "Q:P":  [100, 0],
    "K:P":  [0, 100],
    # P2 after P1 Bet
    "J:B":  [100, 0],
    "Q:B":  [67, 33],
    "K:B":  [0, 100],
    # P1 after P1 Pass -> P2 Bet
    "J:PB": [100, 0],
    "Q:PB": [33, 67],
    "K:PB": [0, 100],
}

def print_section(title, keys, strategy):
    print(f"  {title}")
    print(f"  {'Info Set':<10} {'Calc Pass':>10} {'Exp Pass':>10} {'Calc Bet':>10} {'Exp Bet':>10}")
    print("  " + "-" * 54)
    for key in keys:
        probs = strategy.get(key, [0.0, 0.0])
        exp = EXPECTED.get(key, [0, 0])
        print(f"  {key:<10} {probs[0]*100:>9.1f}% {exp[0]:>9}%  {probs[1]*100:>9.1f}% {exp[1]:>9}%")
    print()

def run():
    game = KuhnPokerRules()
    cfr = CFR(game)

    print(f"Training CFR on Kuhn Poker for {ITERATIONS:,} iterations...\n")
    cfr.train(ITERATIONS)

    strategy = cfr.get_strategy()

    print_section(
        "P1 Opening Action",
        ["J:", "Q:", "K:"],
        strategy
    )
    print_section(
        "P2 Response (P1 Passed)",
        ["J:P", "Q:P", "K:P"],
        strategy
    )
    print_section(
        "P2 Response (P1 Bet)",
        ["J:B", "Q:B", "K:B"],
        strategy
    )
    print_section(
        "P1 Response (P1 Passed -> P2 Bet)",
        ["J:PB", "Q:PB", "K:PB"],
        strategy
    )

if __name__ == '__main__':
    run()


"""
Test CFR training on Kuhn Poker.

Expected Nash equilibrium strategy for Kuhn Poker (KQJ):
  J (Jack)  - lowest card
    J:   ~33% Bet  (bluff with probability 1/3)
    J:PB ~33% Bet  (call with probability 1/3)
  Q (Queen) - middle card
    Q:   ~0%  Bet  (always pass)
    Q:PB ~33% Bet  (call ~1/3 of the time)
  K (King)  - highest card
    K:   ~100% Bet (always bet)
    K:PB ~100% Bet (always call)
"""

import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from src.algorithms.cfr import CFR
from src.training.kuhn_poker import KuhnPokerRules

ITERATIONS = 100000000

def run():
    game = KuhnPokerRules()
    cfr = CFR(game)

    print(f"Training CFR on Kuhn Poker for {ITERATIONS:,} iterations...\n")
    cfr.train(ITERATIONS)

    strategy = cfr.get_strategy()

    # Info set order: card:history  →  [P%, B%]
    print(f"{'Info Set':<10} {'Pass %':>8} {'Bet %':>8}")
    print("-" * 30)
    for key in sorted(strategy.keys()):
        probs = strategy[key]
        print(f"{key:<10} {probs[0]*100:>7.1f}%  {probs[1]*100:>7.1f}%")

    print("\nExpected Nash equilibrium (approximate):")
    print("  J:    ~67% Pass,  ~33% Bet  (bluff 1/3)")
    print("  J:PB  ~67% Pass,  ~33% Bet  (call 1/3)")
    print("  Q:    ~100% Pass, ~0%  Bet")
    print("  Q:PB  ~67% Pass,  ~33% Bet")
    print("  K:    ~0%  Pass,  ~100% Bet")
    print("  K:PB  ~0%  Pass,  ~100% Bet")

if __name__ == '__main__':
    run()


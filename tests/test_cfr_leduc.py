"""
Test CFR training on Leduc Poker.

Leduc Poker:
  Deck: 6 cards — two each of J, Q, K
  Two rounds of betting with a community card revealed between rounds.
  Round 1 bet size: 2, Round 2 bet size: 4.
  Actions: P (Pass/Check), B (Bet), F (Fold), C (Call), R (Raise)

No closed-form Nash equilibrium to compare against, so this test
verifies structural properties that must hold at convergence:
  - All probabilities in [0, 1] and sum to 1
  - Higher cards bet/call more often than lower cards in symmetric spots
  - Strategies change meaningfully from the uniform initialization
"""

import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from src.algorithms.cfr import CFR
from src.training.leduc_poker import LeducPokerRules

ITERATIONS = 100_000


def check_valid_distribution(strategy):
    """Every info set strategy must be a valid probability distribution."""
    errors = []
    for key, probs in strategy.items():
        total = sum(probs)
        if abs(total - 1.0) > 1e-6:
            errors.append(f"  {key}: probabilities sum to {total:.6f}")
        for i, p in enumerate(probs):
            if p < -1e-6 or p > 1.0 + 1e-6:
                errors.append(f"  {key}: action {i} has probability {p:.6f}")
    return errors


def check_card_ordering(strategy):
    """In symmetric spots, stronger cards should bet/call at least as often."""
    ordering_violations = []
    # Round 1 opening: J, Q, K with empty history
    # Bet probability should increase with card strength
    r1_keys = {"J:": None, "Q:": None, "K:": None}
    for key in r1_keys:
        if key in strategy:
            r1_keys[key] = strategy[key]

    if all(v is not None for v in r1_keys.values()):
        j_bet = r1_keys["J:"][1]
        q_bet = r1_keys["Q:"][1]
        k_bet = r1_keys["K:"][1]
        # K should bet more than J (Q can be anywhere due to bluffing)
        if k_bet < j_bet - 0.05:
            ordering_violations.append(
                f"  K bets less than J at opening (K:{k_bet:.3f} < J:{j_bet:.3f})"
            )

    return ordering_violations


def check_not_uniform(strategy):
    """Strategy should have moved away from uniform initialization."""
    uniform_count = 0
    for key, probs in strategy.items():
        n = len(probs)
        uniform = 1.0 / n
        if all(abs(p - uniform) < 0.01 for p in probs):
            uniform_count += 1

    uniform_pct = uniform_count / len(strategy) * 100
    if uniform_pct > 20:
        return [f"  {uniform_pct:.1f}% of info sets are still near-uniform"]
    return []


def print_round1_strategies(strategy):
    """Print round 1 strategies for inspection."""
    print("  Round 1 — Opening (no community card visible)")
    print(f"  {'Info Set':<10} {'Pass':>8} {'Bet':>8}")
    print("  " + "-" * 28)
    for card in ["J:", "Q:", "K:"]:
        if card in strategy:
            probs = strategy[card]
            print(f"  {card:<10} {probs[0]*100:>7.1f}% {probs[1]*100:>7.1f}%")
    print()


def print_round1_responses(strategy):
    """Print round 1 response strategies."""
    print("  Round 1 — Response to Bet")
    print(f"  {'Info Set':<10} {'Fold':>8} {'Call':>8} {'Raise':>8}")
    print("  " + "-" * 40)
    for card in ["J:B", "Q:B", "K:B"]:
        if card in strategy:
            probs = strategy[card]
            print(f"  {card:<10} {probs[0]*100:>7.1f}% {probs[1]*100:>7.1f}% {probs[2]*100:>7.1f}%")
    print()


def print_sample_round2(strategy):
    """Print a sample of round 2 strategies."""
    print("  Round 2 — Sample (after check-check, board=Q)")
    print(f"  {'Info Set':<20} {'Pass':>8} {'Bet':>8}")
    print("  " + "-" * 38)
    for card in ["J", "Q", "K"]:
        key = f"{card}|Q:PP//"
        if key in strategy:
            probs = strategy[key]
            print(f"  {key:<20} {probs[0]*100:>7.1f}% {probs[1]*100:>7.1f}%")
    print()


def run():
    game = LeducPokerRules()
    cfr = CFR(game)

    print(f"Training CFR on Leduc Poker for {ITERATIONS:,} iterations...\n")
    cfr.train(ITERATIONS)

    strategy = cfr.get_strategy()
    print(f"  Total info sets: {len(strategy)}\n")

    # Print strategies
    print_round1_strategies(strategy)
    print_round1_responses(strategy)
    print_sample_round2(strategy)

    # Run checks
    all_passed = True

    print("  Checks:")

    errors = check_valid_distribution(strategy)
    if errors:
        print("  FAIL — Invalid probability distributions:")
        for e in errors:
            print(e)
        all_passed = False
    else:
        print("  PASS — All strategies are valid probability distributions")

    errors = check_card_ordering(strategy)
    if errors:
        print("  FAIL — Card ordering violations:")
        for e in errors:
            print(e)
        all_passed = False
    else:
        print("  PASS — Card strength ordering holds at opening")

    errors = check_not_uniform(strategy)
    if errors:
        print("  FAIL — Strategy too close to uniform:")
        for e in errors:
            print(e)
        all_passed = False
    else:
        print("  PASS — Strategy has diverged from uniform initialization")

    print()
    if all_passed:
        print("  All checks passed.")
    else:
        print("  Some checks FAILED.")


if __name__ == '__main__':
    run()

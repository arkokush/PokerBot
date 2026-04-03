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

CARD_NAMES = {0: 'J', 1: 'J', 2: 'Q', 3: 'Q', 4: 'K', 5: 'K'}
HOLE_CARDS = ['J', 'Q', 'K']
BOARD_CARDS = ['J', 'Q', 'K']

ACTION_LABELS = {
    2: ('Pass', 'Bet'),
    3: ('Fold', 'Call', 'Raise'),
}


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
    r1_keys = {"J:": None, "Q:": None, "K:": None}
    for key in r1_keys:
        if key in strategy:
            r1_keys[key] = strategy[key]

    if all(v is not None for v in r1_keys.values()):
        j_bet = r1_keys["J:"][1]
        k_bet = r1_keys["K:"][1]
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


def format_row(key, probs):
    """Format one info set row with dynamic column count."""
    labels = ACTION_LABELS.get(len(probs))
    if labels:
        cols = "  ".join(f"{l}: {p*100:>5.1f}%" for l, p in zip(labels, probs))
    else:
        cols = "  ".join(f"{p*100:>5.1f}%" for p in probs)
    return f"  {key:<22} {cols}"


def get_round1_keys(strategy):
    """Get all round 1 info set keys, grouped by history."""
    keys = []
    for key in strategy:
        if '|' not in key:
            keys.append(key)
    return keys


def get_round2_keys(strategy, board):
    """Get all round 2 info set keys for a given board card."""
    keys = []
    for key in strategy:
        if f'|{board}:' in key:
            keys.append(key)
    return keys


def sort_info_keys(keys):
    """Sort info set keys by history length then alphabetically."""
    return sorted(keys, key=lambda k: (len(k.split(':')[1]), k))


def print_full_table(strategy):
    """Print the complete strategy table grouped by card and round."""
    print("\n" + "=" * 60)
    print("  FULL STRATEGY TABLE")
    print("=" * 60)

    for hole in HOLE_CARDS:
        print(f"\n  === Holding: {hole} ===\n")

        # Round 1
        r1 = sort_info_keys([k for k in get_round1_keys(strategy) if k.startswith(f"{hole}:")])
        if r1:
            print(f"  Round 1:")
            for key in r1:
                print(format_row(key, strategy[key]))
            print()

        # Round 2 by board card
        for board in BOARD_CARDS:
            pair = " (PAIR)" if hole == board else ""
            r2 = sort_info_keys(get_round2_keys(strategy, board))
            r2 = [k for k in r2 if k.startswith(f"{hole}|")]
            if r2:
                print(f"  Round 2 — Board: {board}{pair}:")
                for key in r2:
                    print(format_row(key, strategy[key]))
                print()


def print_deal_table(strategy, hole_card, board_card):
    """Print strategy table filtered to a specific deal."""
    print(f"\n  === Holding: {hole_card}  |  Board: {board_card} ===\n")

    # Round 1 — always the same for a given hole card
    r1 = sort_info_keys([k for k in get_round1_keys(strategy) if k.startswith(f"{hole_card}:")])
    if r1:
        print(f"  Round 1:")
        for key in r1:
            print(format_row(key, strategy[key]))
        print()

    # Round 2 for specific board
    pair = " (PAIR)" if hole_card == board_card else ""
    r2 = sort_info_keys(get_round2_keys(strategy, board_card))
    r2 = [k for k in r2 if k.startswith(f"{hole_card}|")]
    if r2:
        print(f"  Round 2 — Board: {board_card}{pair}:")
        for key in r2:
            print(format_row(key, strategy[key]))
        print()


def run_checks(strategy):
    """Run validation checks and print results."""
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


def pick_option(prompt, options):
    """Display numbered options and return the chosen value."""
    print(prompt)
    for i, (label, value) in enumerate(options):
        print(f"  [{i}] {label}")
    while True:
        choice = input("> ").strip()
        if choice.isdigit() and 0 <= int(choice) < len(options):
            return options[int(choice)][1]
        print(f"  Enter 0-{len(options)-1}")


def run():
    game = LeducPokerRules()
    cfr = CFR(game)

    print(f"Training CFR on Leduc Poker for {ITERATIONS:,} iterations...\n")
    cfr.train(ITERATIONS)

    strategy = cfr.get_strategy()
    print(f"  Total info sets: {len(strategy)}\n")

    run_checks(strategy)

    while True:
        print()
        mode = pick_option("View strategy:", [
            ("Full table (all info sets)", "full"),
            ("Filter by deal (pick hole + board)", "deal"),
            ("Quit", "quit"),
        ])

        if mode == "quit":
            break
        elif mode == "full":
            print_full_table(strategy)
        elif mode == "deal":
            hole = pick_option("Hole card:", [(c, c) for c in HOLE_CARDS])
            board = pick_option("Board card:", [(c, c) for c in BOARD_CARDS])
            print_deal_table(strategy, hole, board)


if __name__ == '__main__':
    run()

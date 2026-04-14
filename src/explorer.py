"""
Interactive game tree explorer for trained CFR strategies.

Navigate the game tree node by node, view info set strategies,
and choose actions manually or let the bot pick randomly
weighted by the trained strategy.

Usage:
    python -m src.explorer
"""

import random
import sys
from src.algorithms.cfr import CFR
from src.training.kuhn_poker import KuhnPokerRules
from src.training.leduc_poker import LeducPokerRules
from src.algorithms.exploitability import compute_exploitability
from src.train_exploit import train_with_exploitability, print_convergence_graph

CARD_NAMES = {0: 'J', 1: 'J', 2: 'Q', 3: 'Q', 4: 'K', 5: 'K'}
KUHN_CARD_NAMES = {0: 'J', 1: 'Q', 2: 'K'}

KUHN_ACTIONS = {'P': 'Pass/Check', 'B': 'Bet/Call'}
LEDUC_ACTIONS = {'P': 'Pass/Check', 'B': 'Bet', 'F': 'Fold', 'C': 'Call', 'R': 'Raise', '//': 'Deal community card'}


def train(game, iterations):
    cfr = CFR(game)
    print(f"\nTraining for {iterations:,} iterations...\n")
    iters_log, exploit_log = train_with_exploitability(cfr, iterations)
    game_name = "Kuhn Poker" if len(game.deal_cards()) == 2 else "Leduc Poker"
    print_convergence_graph(iters_log, exploit_log, game_name)
    print(f"\n  Final exploitability: {exploit_log[-1]:.6f}\n")
    return cfr


def pick_option(prompt, options):
    """Display numbered options and return the chosen one."""
    print(prompt)
    for i, (label, value) in enumerate(options):
        print(f"  [{i}] {label}")
    while True:
        choice = input("> ").strip()
        if choice.isdigit() and 0 <= int(choice) < len(options):
            return options[int(choice)][1]
        print(f"  Enter 0-{len(options)-1}")


def weighted_random(options, weights):
    """Pick a random option weighted by probabilities."""
    r = random.random()
    cumulative = 0.0
    for opt, w in zip(options, weights):
        cumulative += w
        if r <= cumulative:
            return opt
    return options[-1]


def format_strategy(actions, probs, action_labels):
    """Format a strategy as a readable string."""
    parts = []
    for a, p in zip(actions, probs):
        label = action_labels.get(a, a)
        parts.append(f"{label}: {p*100:.1f}%")
    return "  |  ".join(parts)


def show_info_set(cfr, game, player_card, history, com_card, is_kuhn):
    """Display the strategy at the current info set. Returns (actions, probs)."""
    if is_kuhn:
        com_cards = (None, None, None)
    else:
        com_cards = (com_card, None, None)

    key = game.get_info_set_string(player_card, history, com_cards)
    actions = game.get_legal_actions(history)
    action_labels = KUHN_ACTIONS if is_kuhn else LEDUC_ACTIONS

    if key in cfr.info_sets:
        probs = cfr.info_sets[key].get_average_strategy()
        print(f"\n  Info set: {key}")
        print(f"  Strategy: {format_strategy(actions, probs, action_labels)}")
        return actions, probs
    else:
        print(f"\n  Info set: {key}  (not visited during training)")
        n = len(actions)
        return actions, [1.0 / n] * n


def explore_kuhn(cfr, game):
    """Interactive explorer for Kuhn Poker."""
    while True:
        print("=" * 50)

        # Deal cards
        deal_options = [(f"{KUHN_CARD_NAMES[c]}", c) for c in [0, 1, 2]]
        deal_options.append(("Random", "random"))

        p0_card = pick_option("P0's card:", deal_options)
        if p0_card == "random":
            p0_card = random.choice([0, 1, 2])
            print(f"  -> {KUHN_CARD_NAMES[p0_card]}")

        remaining = [c for c in [0, 1, 2] if c != p0_card]
        p1_options = [(f"{KUHN_CARD_NAMES[c]}", c) for c in remaining]
        p1_options.append(("Random", "random"))

        p1_card = pick_option("P1's card:", p1_options)
        if p1_card == "random":
            p1_card = random.choice(remaining)
            print(f"  -> {KUHN_CARD_NAMES[p1_card]}")

        cards = (p0_card, p1_card)
        history = ""

        print(f"\n  Deal: P0={KUHN_CARD_NAMES[p0_card]}  P1={KUHN_CARD_NAMES[p1_card]}")

        while True:
            player = len(history) % 2
            player_card = cards[player]

            if game.is_terminal(history):
                com_cards = (None, None, None)
                payoff = game.get_payoff(cards[:2], history, com_cards)
                print(f"\n  Terminal: history={history or '(empty)'}")
                print(f"  Payoff: P0 {'wins' if payoff > 0 else 'loses'} {abs(payoff):.0f}")
                break

            print(f"\n  History: {history or '(start)'}")
            print(f"  P{player}'s turn (holding {KUHN_CARD_NAMES[player_card]})")

            actions, probs = show_info_set(cfr, game, player_card, history, None, True)

            options = [(f"{a} ({KUHN_ACTIONS[a]})", a) for a in actions]
            options.append(("Random (strategy-weighted)", "random"))
            options.append(("Back to deal select", None))
            action = pick_option("Choose action:", options)

            if action is None:
                break
            if action == "random":
                action = weighted_random(actions, probs)
                print(f"  -> {action} ({KUHN_ACTIONS[action]})")
            history += action

        print()
        again = input("New deal? [Y/n] ").strip().lower()
        if again == 'n':
            break


def explore_leduc(cfr, game):
    """Interactive explorer for Leduc Poker."""
    card_options = [(f"{CARD_NAMES[c]} (card {c})", c) for c in range(6)]
    card_options.append(("Random", "random"))

    while True:
        print("=" * 50)

        # Deal P0
        p0_card = pick_option("P0's card:", card_options)
        if p0_card == "random":
            p0_card = random.choice(range(6))
            print(f"  -> {CARD_NAMES[p0_card]} (card {p0_card})")

        # Deal P1
        remaining_cards = [c for c in range(6) if c != p0_card]
        p1_options = [(f"{CARD_NAMES[c]} (card {c})", c) for c in remaining_cards]
        p1_options.append(("Random", "random"))

        p1_card = pick_option("P1's card:", p1_options)
        if p1_card == "random":
            p1_card = random.choice(remaining_cards)
            print(f"  -> {CARD_NAMES[p1_card]} (card {p1_card})")

        used = {p0_card, p1_card}
        com_available = [c for c in range(6) if c not in used]

        cards = (p0_card, p1_card)
        com_card = None
        history = ""

        print(f"\n  Deal: P0={CARD_NAMES[p0_card]}({p0_card})  P1={CARD_NAMES[p1_card]}({p1_card})")

        while True:
            if game.is_terminal(history):
                com_cards = (com_card, None, None)
                payoff = game.get_payoff(cards, history, com_cards)
                pot = game._calculate_pot(history)
                print(f"\n  Terminal: history={history}")
                if com_card is not None:
                    print(f"  Community: {CARD_NAMES[com_card]}({com_card})")
                print(f"  Pot: {pot}  |  Payoff: P0 {'wins' if payoff > 0 else 'loses' if payoff < 0 else 'ties for'} {abs(payoff):.0f}")
                break

            actions = game.get_legal_actions(history)

            # Round transition — pick community card
            if actions == ["//"]:
                if com_card is None:
                    print(f"\n  Round 1 complete (history={history}). Deal community card:")
                    com_options = [(f"{CARD_NAMES[c]} (card {c})", c) for c in com_available]
                    com_options.append(("Random", "random"))
                    com_card = pick_option("Community card:", com_options)
                    if com_card == "random":
                        com_card = random.choice(com_available)
                        print(f"  -> {CARD_NAMES[com_card]} (card {com_card})")
                    else:
                        print(f"  Community card: {CARD_NAMES[com_card]}({com_card})")
                history += "//"
                continue

            rounds = history.split("//")
            current_round = rounds[-1]
            player = len(current_round) % 2
            player_card = cards[player]

            round_num = len(rounds)
            print(f"\n  History: {history or '(start)'}  |  Round {round_num}")
            if com_card is not None:
                print(f"  Community: {CARD_NAMES[com_card]}({com_card})")
            print(f"  P{player}'s turn (holding {CARD_NAMES[player_card]}({player_card}))")

            actions, probs = show_info_set(cfr, game, player_card, history, com_card, False)

            options = [(f"{a} ({LEDUC_ACTIONS[a]})", a) for a in actions]
            options.append(("Random (strategy-weighted)", "random"))
            options.append(("Back to deal select", None))
            action = pick_option("Choose action:", options)

            if action is None:
                break
            if action == "random":
                action = weighted_random(actions, probs)
                print(f"  -> {action} ({LEDUC_ACTIONS[action]})")
            history += action

        print()
        again = input("New deal? [Y/n] ").strip().lower()
        if again == 'n':
            break


def main():
    print("=" * 50)
    print("  CFR Strategy Explorer")
    print("=" * 50)

    game_choice = pick_option("Select game:", [
        ("Kuhn Poker (J/Q/K)", "kuhn"),
        ("Leduc Poker (JJ/QQ/KK)", "leduc"),
    ])

    iters = input("Training iterations [default 300000]: ").strip()
    iterations = int(iters) if iters.isdigit() else 300_000

    if game_choice == "kuhn":
        game = KuhnPokerRules()
        cfr = train(game, iterations)
        explore_kuhn(cfr, game)
    else:
        game = LeducPokerRules()
        cfr = train(game, iterations)
        explore_leduc(cfr, game)

    print("Done.")


if __name__ == '__main__':
    main()

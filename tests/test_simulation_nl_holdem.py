"""Tests for the NL Hold'em simulation: betting-round closure, all-ins,
side pots, heads-up blinds, and chip conservation."""
import warnings

import pytest

from src.simulation.nl_holdem import NLHoldem
from src.utils.cards import Card
from src.utils.player import Agent, Player


class ScriptedAgent(Agent):
    """Plays a fixed action sequence, then checks/calls; records every state."""

    def __init__(self, actions=()):
        self.actions = list(actions)
        self.calls = []

    def decide(self, state):
        self.calls.append({
            "call_amnt": state["call_amnt"],
            "may_raise": state["may_raise"],
            "n_community": len(state["community_cards"]),
        })
        if self.actions:
            return self.actions.pop(0)
        return "Check" if state["call_amnt"] == 0 else "Call"


def make_players(*stacks_and_actions):
    players = []
    for idx, (stack, actions) in enumerate(stacks_and_actions):
        players.append(Player(stack, ScriptedAgent(actions), name=f"P{idx}"))
    return players


def total_chips(game):
    return sum(p.stack for p in game.players) + game.pot


def test_fold_does_not_close_round_early():
    # 3-handed, first hand: dealer=0, SB=1, BB=2, button acts first preflop.
    # Button raises, SB folds -> the BB must still get to act facing the raise.
    players = make_players(
        (100, ["Raise 4"]),   # P0 button: raise to 6
        (100, ["Fold"]),      # P1 SB: fold
        (100, []),            # P2 BB: script empty -> calls/checks
    )
    game = NLHoldem(players, big_blind=2)
    before = sum(p.stack for p in players)
    game.startRound()

    bb_calls = players[2].agent.calls
    assert bb_calls, "BB never got to act after button raise + SB fold"
    assert bb_calls[0]["call_amnt"] == 4, (
        "BB should face the raise (owes 4 more on top of the posted blind)"
    )
    assert sum(p.stack for p in players) == before
    assert game.pot == 0


def test_all_in_preflop_terminates_and_deals_full_board():
    # Heads-up: both players all-in preflop must not hang; the full board
    # is dealt and the pot is distributed.
    players = make_players(
        (100, ["Raise 200"]),  # P0 button/SB: all-in
        (100, ["Call"]),       # P1 BB: call all-in
    )
    game = NLHoldem(players, big_blind=2)
    game.startRound()

    assert len(game.community_cards) == 5
    assert sum(p.stack for p in players) == 200
    assert game.pot == 0
    # Each player acted exactly once (no double-prompt of all-in players).
    assert len(players[0].agent.calls) == 1
    assert len(players[1].agent.calls) == 1


def test_call_for_less_goes_all_in_without_crash():
    # P1 has only 30; facing a bigger bet, calling puts them all-in for less
    # and the uncalled excess is returned to P0 at showdown.
    players = make_players(
        (100, ["Raise 50"]),  # P0 button/SB
        (30, ["Call"]),       # P1 BB: all-in for less
    )
    game = NLHoldem(players, big_blind=2)
    game.startRound()

    assert sum(p.stack for p in players) == 130
    assert game.pot == 0
    # P1 could lose at most 30, so P0's stack is at least 100 - 30 = 70,
    # and no more than 130 (winning P1's 30).
    assert 70 <= players[0].stack <= 130


def test_heads_up_blinds_and_acting_order():
    # First hand: dealer/button = seat 0. Button posts the SMALL blind and
    # acts first preflop; the BB acts first postflop.
    players = make_players((100, []), (100, []))
    game = NLHoldem(players, big_blind=2)
    game.startRound()

    p0_first = players[0].agent.calls[0]
    assert p0_first["n_community"] == 0
    assert p0_first["call_amnt"] == 1, (
        "button should owe exactly the SB->BB difference preflop"
    )
    # First postflop action belongs to the non-button player.
    p1_flop_calls = [c for c in players[1].agent.calls if c["n_community"] == 3]
    p0_flop_calls = [c for c in players[0].agent.calls if c["n_community"] == 3]
    assert p1_flop_calls and p0_flop_calls


def test_short_all_in_raise_does_not_reopen_action():
    # P0 raises to 10 (full raise). P2's all-in adds only 2 more, which is
    # below the min-raise of 8: P0 may call but NOT raise again.
    players = make_players(
        (100, ["Raise 8", "Raise 50"]),  # 2nd raise must be downgraded to call
        (100, ["Fold"]),
        (12, ["Raise 100"]),             # BB: all-in for 12 total (short raise)
    )
    game = NLHoldem(players, big_blind=2)
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        game.startRound()

    p0_second = players[0].agent.calls[1]
    assert p0_second["call_amnt"] == 2
    assert p0_second["may_raise"] is False
    # P0 was downgraded to a call: exactly 12 contributed, not 12 + 50.
    assert game.contributions[0] == 12
    assert sum(p.stack for p in players) == 212
    assert game.pot == 0


def test_everyone_folds_ends_hand_immediately():
    players = make_players(
        (100, ["Fold"]),  # P0 button/SB folds at once
        (100, []),
    )
    game = NLHoldem(players, big_blind=2)
    game.startRound()

    assert game.community_cards == []
    assert players[0].stack == 99
    assert players[1].stack == 101
    assert game.pot == 0


def test_side_pot_short_stack_winner_only_wins_covered_layer():
    # Direct getWinner test with fixed hands: A (short, best hand) is all-in
    # for 10; B and C contributed 100 each. A must win only 30; B (second
    # best) wins the 180 side pot.
    players = make_players((0, []), (0, []), (0, []))
    game = NLHoldem(players, big_blind=2)
    game.dealer_index = 0
    community = [Card(c) for c in ("2c", "7d", "9h", "Ts", "Kd")]
    players[0].hand = [Card("Kh"), Card("Ks")]  # trips kings — best
    players[1].hand = [Card("Ah"), Card("Kc")]  # pair kings, ace kicker
    players[2].hand = [Card("Qh"), Card("Qs")]  # pair queens — worst
    game.contributions = [10, 100, 100]
    game.pot = 210

    game.getWinner(community, players, game.pot)

    assert players[0].stack == 30    # main pot only
    assert players[1].stack == 180   # side pot
    assert players[2].stack == 0
    assert game.pot == 0


def test_split_pot_odd_chip_goes_left_of_button():
    # B and C tie; a folded player's chip makes one layer odd. The odd chip
    # goes to the first winner left of the button.
    players = make_players((0, []), (0, []), (0, []))
    game = NLHoldem(players, big_blind=2)
    game.dealer_index = 0
    community = [Card(c) for c in ("2c", "7d", "9h", "Ts", "Kd")]
    players[0].hand = [Card("Ah"), Card("3c")]
    players[0].folded = True
    players[1].hand = [Card("Qh"), Card("Qs")]
    players[2].hand = [Card("Qd"), Card("Qc")]
    game.contributions = [1, 2, 2]
    game.pot = 5

    game.getWinner(community, players, game.pot)

    assert players[1].stack + players[2].stack == 5
    assert players[1].stack == 3   # seat 1 is first left of the button
    assert players[2].stack == 2
    assert game.pot == 0


def test_chip_conservation_with_garbage_agent():
    # An agent that emits nonsense must be folded, never crash the game or
    # destroy chips.
    players = make_players(
        (100, ["Banana", "Banana", "Banana"]),
        (100, []),
    )
    game = NLHoldem(players, big_blind=2)
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        game.startRound()

    assert sum(p.stack for p in players) == 200
    assert game.pot == 0


def test_multiway_hands_conserve_chips_over_many_rounds():
    import random as _random
    _random.seed(7)
    from src.utils.player import RandomAgent

    players = [Player(200, RandomAgent(), name=f"P{i}") for i in range(4)]
    game = NLHoldem(players, big_blind=4)
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        for _ in range(30):
            in_play = [p for p in players if p.stack > game.BIGBLIND_BET]
            if len(in_play) < 2:
                break
            # Re-seat only players who can still post a blind.
            game.players = in_play
            game.num_players = len(in_play)
            game.contributions = [0] * len(in_play)
            game.dealer_index = game.dealer_index % len(in_play) \
                if game.dealer_index is not None else None
            game.startRound()
            assert sum(p.stack for p in players) == 800
            assert game.pot == 0

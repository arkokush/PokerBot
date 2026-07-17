"""Unit tests for the heads-up limit hold'em game rules (key grammar).

The grammar here is the contract mirrored by the web key builder in
web/src/bots/mccfr.ts — these tests pin it down on the Python side.
"""
import pytest

from src.training.limit_poker import LimitPokerRules


@pytest.fixture(scope="module")
def game():
    return LimitPokerRules()


def test_preflop_opening_actions_face_the_blind(game):
    assert game.get_legal_actions("") == ['F', 'C', 'R']


def test_bb_option_after_limp(game):
    assert game.get_legal_actions("C") == ['P', 'R']


def test_limp_check_ends_preflop(game):
    assert game.get_legal_actions("CP") == ["//"]
    assert not game.is_terminal("CP")


def test_closing_call_ends_preflop(game):
    assert game.get_legal_actions("RC") == ["//"]
    assert game.get_legal_actions("CRC") == ["//"]


def test_raise_cap_is_three_raises_preflop(game):
    assert game.get_legal_actions("CR") == ['F', 'C', 'R']
    assert game.get_legal_actions("RRR") == ['F', 'C']
    assert game.get_legal_actions("CRRR") == ['F', 'C']


def test_postflop_grammar(game):
    assert game.get_legal_actions("CP//") == ['P', 'B']
    assert game.get_legal_actions("CP//P") == ['P', 'B']
    assert game.get_legal_actions("CP//PB") == ['F', 'C', 'R']
    assert game.get_legal_actions("CP//BRRR") == ['F', 'C']
    assert game.get_legal_actions("CP//PP") == ["//"]


def test_acting_order(game):
    assert game.get_acting_player("") == 1        # SB/button first preflop
    assert game.get_acting_player("C") == 0       # BB option
    assert game.get_acting_player("CP//") == 0    # BB first postflop
    assert game.get_acting_player("CP//P") == 1


def test_immediate_fold_loses_the_small_blind(game):
    assert game.is_terminal("F")
    assert game.get_payoff(((0, 1), (2, 3)), "F", ((), None, None)) == 1


def test_fold_to_raise_loses_the_big_blind(game):
    assert game.is_terminal("RF")
    assert game.get_payoff(((0, 1), (2, 3)), "RF", ((), None, None)) == -2


def test_commitments(game):
    assert game._calculate_commitments("CP") == [2, 2]
    assert game._calculate_commitments("RC") == [4, 4]
    assert game._calculate_commitments("CRC") == [4, 4]
    assert game._calculate_commitments("CP//PBC") == [4, 4]
    # Turn/river bets are 4: limp-check, check-check flop, bet-call turn.
    assert game._calculate_commitments("CP//PP//BC") == [6, 6]


def test_terminal_requires_four_completed_rounds(game):
    assert not game.is_terminal("CP//PP//PP")
    assert game.is_terminal("CP//PP//PP//PP")
    assert game.is_terminal("CP//PP//PP//PBF")

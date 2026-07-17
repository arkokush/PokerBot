"""Kuhn Poker CFR convergence tests.

Kuhn has a one-parameter family of Nash equilibria (alpha in [0, 1/3]):
P0's individual opening frequencies are NOT unique, so we assert only the
unique quantities (P1's responses) plus the family invariants that hold at
every equilibrium:
    P0 bets K exactly 3x as often as J, and
    P0's Q call-vs-bet frequency equals (J bet frequency) + 1/3.
"""
import random

import pytest

from src.algorithms.cfr import CFR
from src.algorithms.exploitability import compute_exploitability
from src.training.kuhn_poker import KuhnPokerRules


class _FixedInfoSet:
    def __init__(self, probs):
        self._probs = list(probs)

    def get_average_strategy(self):
        return self._probs


@pytest.fixture(scope="module")
def trained():
    random.seed(42)
    cfr = CFR(KuhnPokerRules())
    cfr.train(100_000)
    return cfr


def test_p1_unique_responses(trained):
    s = trained.get_strategy()  # actions are [P, B]
    assert s["J:B"][0] == pytest.approx(1.0, abs=0.03)   # fold J to a bet
    assert s["K:B"][1] == pytest.approx(1.0, abs=0.03)   # call with K
    assert s["Q:B"][1] == pytest.approx(1 / 3, abs=0.05) # call Q 1/3
    assert s["J:P"][1] == pytest.approx(1 / 3, abs=0.05) # bluff J 1/3 after check
    assert s["K:P"][1] == pytest.approx(1.0, abs=0.03)   # bet K after check


def test_p0_family_invariants(trained):
    s = trained.get_strategy()
    j_bet = s["J:"][1]
    k_bet = s["K:"][1]
    q_call = s["Q:PB"][1]
    assert 0.0 <= j_bet <= 1 / 3 + 0.05
    assert k_bet == pytest.approx(3 * j_bet, abs=0.06)
    assert q_call == pytest.approx(j_bet + 1 / 3, abs=0.06)
    assert s["Q:"][1] == pytest.approx(0.0, abs=0.03)    # never open-bet Q
    assert s["J:PB"][1] == pytest.approx(0.0, abs=0.03)  # never call with J
    assert s["K:PB"][1] == pytest.approx(1.0, abs=0.03)  # always call with K


def test_trained_strategy_low_exploitability(trained):
    exploit = compute_exploitability(trained.info_sets, trained.game)
    assert exploit >= -1e-9
    assert exploit < 0.01


def test_hand_built_nash_has_zero_exploitability():
    # Alpha = 0.2 member of the equilibrium family (actions are [P, B]).
    a = 0.2
    strategies = {
        "J:":   [1 - a, a],
        "Q:":   [1.0, 0.0],
        "K:":   [1 - 3 * a, 3 * a],
        "J:PB": [1.0, 0.0],
        "Q:PB": [1 - (a + 1 / 3), a + 1 / 3],
        "K:PB": [0.0, 1.0],
        "J:P":  [2 / 3, 1 / 3],
        "Q:P":  [1.0, 0.0],
        "K:P":  [0.0, 1.0],
        "J:B":  [1.0, 0.0],
        "Q:B":  [2 / 3, 1 / 3],
        "K:B":  [0.0, 1.0],
    }
    info_sets = {k: _FixedInfoSet(v) for k, v in strategies.items()}
    exploit = compute_exploitability(info_sets, KuhnPokerRules())
    assert exploit == pytest.approx(0.0, abs=1e-9)


def test_uniform_strategy_is_clearly_exploitable():
    uniform = {
        key: _FixedInfoSet([0.5, 0.5])
        for key in ["J:", "Q:", "K:", "J:PB", "Q:PB", "K:PB",
                    "J:P", "Q:P", "K:P", "J:B", "Q:B", "K:B"]
    }
    exploit = compute_exploitability(uniform, KuhnPokerRules())
    assert exploit > 0.1

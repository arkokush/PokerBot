"""Tests for the Kuhn Poker simulation: legality handling and chip
conservation, including hostile agents."""
import warnings

from src.simulation.kuhn_poker import KuhnPoker
from src.simulation.agents.kuhn_agents import KuhnRandomAgent
from src.utils.player import Agent, Player


class FixedAgent(Agent):
    def __init__(self, action):
        self.action = action

    def decide(self, state):
        return self.action


def play_rounds(game, n):
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        for _ in range(n):
            game.startRound()


def test_chips_conserved_with_random_agents():
    import random as _random
    _random.seed(11)
    p1 = Player(50, KuhnRandomAgent(), name="P1")
    p2 = Player(50, KuhnRandomAgent(), name="P2")
    game = KuhnPoker([p1, p2])
    play_rounds(game, 100)
    assert p1.stack + p2.stack == 100
    assert game.pot == 0


def test_garbage_actions_never_leak_the_pot():
    # An agent that answers nonsense must not make antes/bets evaporate.
    p1 = Player(50, FixedAgent("Banana"), name="P1")
    p2 = Player(50, FixedAgent("Raise 17"), name="P2")
    game = KuhnPoker([p1, p2])
    play_rounds(game, 50)
    assert p1.stack + p2.stack == 100
    assert game.pot == 0


def test_bet_fold_awards_pot_to_bettor():
    p1 = Player(10, FixedAgent("Bet"), name="P1")
    p2 = Player(10, FixedAgent("Fold"), name="P2")
    game = KuhnPoker([p1, p2])
    play_rounds(game, 1)
    # P1 antes 1 + bets 1, gets pot of 3 back: net +1. P2 loses the ante.
    assert p1.stack == 11
    assert p2.stack == 9


def test_current_bet_resets_between_rounds():
    p1 = Player(50, FixedAgent("Check"), name="P1")
    p2 = Player(50, FixedAgent("Check"), name="P2")
    game = KuhnPoker([p1, p2])
    play_rounds(game, 3)
    # After a completed round, per-round betting state must not accumulate.
    assert p1.current_bet <= 2
    assert p2.current_bet <= 2

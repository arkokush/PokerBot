from .info_set import InformationSet
from src.training.base import PokerGameRules
from typing import Dict


class CFR:
    """
    Generic Counterfactual Regret Minimization (CFR) implementation.
    """

    def __init__(self, game: PokerGameRules):
        self.game = game
        self.info_sets: Dict[str, InformationSet] = {}

    def get_info_set(self, info_set_key, num_actions) -> InformationSet:
        """Get or create an information set."""
        if info_set_key not in self.info_sets:
            self.info_sets[info_set_key] = InformationSet(num_actions)
        return self.info_sets[info_set_key]

    def train(self, iterations):
        for _ in range(iterations):
            cards = self.game.deal_cards()
            self.cfr(cards, '', 1.0, 1.0)

    def cfr(self, cards: tuple, history: str, reach_p0: float = 1.0, reach_p1: float = 1.0) -> float:
        player = len(history) % 2
        player_card = cards[player]

        if self.game.is_terminal(history):
            return self.game.get_payoff(cards, history)

        actions = self.game.get_legal_actions(history)
        info_set_key = self.game.get_info_set_string(player_card, history)
        info_set = self.get_info_set(info_set_key, actions)

        my_reach = reach_p0 if player == 0 else reach_p1
        opp_reach = reach_p1 if player == 0 else reach_p0

        action_strategy = info_set.get_strategy(my_reach)
        action_util = [0.0] * len(action_strategy)
        avg_util = 0.0

        for i, action in enumerate(actions):
            if player == 0:
                action_util[i] = self.cfr(cards, history + action, reach_p0 * action_strategy[i], reach_p1)
            else:
                action_util[i] = self.cfr(cards, history + action, reach_p0, reach_p1 * action_strategy[i])
            avg_util += action_strategy[i] * action_util[i]

        for i in range(len(actions)):
            regret = action_util[i] - avg_util
            info_set.regret_sum[i] += opp_reach * regret

        return avg_util

    def get_strategy(self):
        return {key: is_.get_average_strategy() for key, is_ in self.info_sets.items()}



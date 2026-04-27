from typing import Dict
from .info_set import InformationSet
from src.training.base import PokerGameRules


class CFR:
    def __init__(self, game: PokerGameRules):
        self.game = game
        self.info_sets: Dict[str, InformationSet] = {}

    def get_info_set(self, info_set_key: str, num_actions: int) -> InformationSet:
        if info_set_key not in self.info_sets:
            self.info_sets[info_set_key] = InformationSet(num_actions)
        return self.info_sets[info_set_key]

    def train(self, iterations: int):
        """Train CFR for N iterations"""
        for _ in range(iterations):
            cards = self.game.deal_cards()
            self.cfr(cards, "", 1.0, 1.0)

    def cfr(self, cards: tuple, history: str, reach_p0: float, reach_p1: float) -> float:
        """Returns utility from P0's perspective throughout."""
        player = self.game.get_acting_player(history)
        player_card = cards[player]
        flop = cards[2] if len(cards) > 2 else None
        turn = cards[3] if len(cards) > 3 else None
        river = cards[4] if len(cards) > 4 else None

        com_cards = (flop, turn, river)

        if self.game.is_terminal(history):
            return self.game.get_payoff(cards[:2], history, com_cards)

        actions = self.game.get_legal_actions(history)
        info_set_key = self.game.get_info_set_string(player_card, history, com_cards)
        info_set = self.get_info_set(info_set_key, len(actions))

        strategy = info_set.get_strategy()

        my_reach = reach_p0 if player == 0 else reach_p1
        opp_reach = reach_p1 if player == 0 else reach_p0

        for i in range(len(actions)):
            info_set.strategy_sum[i] += my_reach * strategy[i]

        action_utils = [0.0] * len(actions)
        node_util = 0.0

        for i, action in enumerate(actions):
            next_history = history + action

            if player == 0:
                action_utils[i] = self.cfr(cards, next_history, reach_p0 * strategy[i], reach_p1)
            else:
                action_utils[i] = self.cfr(cards, next_history, reach_p0, reach_p1 * strategy[i])
            node_util += strategy[i] * action_utils[i]

        sign = 1 if player == 0 else -1
        for i in range(len(actions)):
            regret = sign * (action_utils[i] - node_util)
            info_set.regret_sum[i] += opp_reach * regret

        return node_util

    def get_strategy(self) -> Dict[str, list]:
        """Return the Average Strategy (Nash Equilibrium)"""
        return {key: info_set.get_average_strategy() for key, info_set in self.info_sets.items()}


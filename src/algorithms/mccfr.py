import random
from typing import Dict
from .info_set import InformationSet
from src.training.base import PokerGameRules


class MCCFR:
    """
    External Sampling MCCFR (Lanctot et al. 2009).

    - Traverser: enumerate all actions, update regrets at its own info sets
    - Opponent: sample one action according to the current strategy; the
      average-strategy sums are accumulated at the OPPONENT's info sets
      (weight 1 per visit), because under external sampling the opponent's
      nodes are reached with probability proportional to the opponent's
      own reach — which is exactly the weighting the average strategy needs.
    """

    def __init__(
        self,
        game: PokerGameRules,
        alpha: float = float("inf"),
        beta: float = float("inf"),
        gamma: float = float("inf"),
        clip: bool = False,
    ):
        # Discount parameters follow DCFR (Brown & Sandholm 2019):
        #   alpha — positive regrets are scaled by t^alpha / (t^alpha + 1)
        #   beta  — negative regrets are scaled by t^beta / (t^beta + 1)
        #   gamma — average-strategy decay: existing strategy sums are scaled
        #           by (t/(t+1))^gamma on each visit before adding the current
        #           strategy with weight 1
        # float("inf") is a sentinel meaning "no discounting" for that term:
        #   alpha/beta = inf -> regret discount factor 1.0
        #   gamma = inf      -> strategy sums accumulate undecayed (weight 1)
        # So the defaults (alpha=beta=gamma=inf, clip=False) recover plain
        # external-sampling MCCFR with uniform strategy averaging.
        self.game = game
        self.info_sets: Dict[str, InformationSet] = {}
        self.t = 0
        self.alpha = alpha
        self.beta = beta
        self.gamma = gamma
        self.clip = clip

    def get_info_set(self, key: str, num_actions: int) -> InformationSet:
        if key not in self.info_sets:
            self.info_sets[key] = InformationSet(num_actions)
        return self.info_sets[key]

    def train(self, iterations: int):
        for _ in range(iterations):
            self.t += 1
            cards = self.game.deal_cards()
            self.traverse(cards, "", 0)
            self.traverse(cards, "", 1)

    def sample_action(self, strategy):
        r = random.random()
        cum = 0.0
        for i, p in enumerate(strategy):
            cum += p
            if r < cum:
                return i
        return len(strategy) - 1

    def _regret_discount(self, exponent: float) -> float:
        """
        Compute the DCFR regret discount t^e / (t^e + 1) in a numerically
        stable way. Returns 1.0 for exponent = inf (sentinel: no discount)
        and when t^e overflows (the ratio tends to 1 as t^e grows).
        """
        if exponent == float("inf"):
            return 1.0
        if exponent == float("-inf"):
            return 0.0
        try:
            p = float(self.t) ** exponent
        except OverflowError:
            return 1.0
        if p == float("inf"):
            return 1.0
        return p / (p + 1.0)

    def traverse(self, cards, history, traversing_player):
        flop = cards[2] if len(cards) > 2 else None
        turn = cards[3] if len(cards) > 3 else None
        river = cards[4] if len(cards) > 4 else None
        board = (flop, turn, river)

        if self.game.is_terminal(history):
            payoff_p0 = self.game.get_payoff(cards[:2], history, board)
            return payoff_p0 if traversing_player == 0 else -payoff_p0

        actions = self.game.get_legal_actions(history)

        # Forced transitions (e.g., round separator) — just recurse, no decision
        if len(actions) == 1 and actions[0] not in ('F', 'P', 'C', 'B', 'R'):
            return self.traverse(cards, history + actions[0], traversing_player)

        player = self.game.get_acting_player(history)
        player_card = cards[player]

        key = self.game.get_info_set_string(player_card, history, board)
        info_set = self.get_info_set(key, len(actions))
        strategy = info_set.get_strategy()

        if player == traversing_player:
            action_utils = [0.0] * len(actions)
            node_util = 0.0

            for i, action in enumerate(actions):
                action_utils[i] = self.traverse(
                    cards, history + action, traversing_player
                )
                node_util += strategy[i] * action_utils[i]

            pos_discount = self._regret_discount(self.alpha)
            neg_discount = self._regret_discount(self.beta)

            for i in range(len(actions)):
                new_regret = action_utils[i] - node_util
                old = info_set.regret_sum[i]
                discounted = old * (pos_discount if old > 0 else neg_discount)
                updated = discounted + new_regret
                if self.clip:
                    updated = max(0.0, updated)
                info_set.regret_sum[i] = updated

            return node_util

        else:
            # Opponent node: accumulate the average strategy HERE (external
            # sampling reaches this node ∝ the opponent's own reach prob,
            # so a weight of 1 gives an unbiased average-strategy update),
            # then sample a single action to continue the traversal.
            if self.gamma == float("inf"):
                for i in range(len(actions)):
                    info_set.strategy_sum[i] += strategy[i]
            else:
                w = (self.t / (self.t + 1)) ** self.gamma
                for i in range(len(actions)):
                    info_set.strategy_sum[i] = info_set.strategy_sum[i] * w + strategy[i]

            sampled_idx = self.sample_action(strategy)
            action = actions[sampled_idx]
            return self.traverse(
                cards, history + action, traversing_player
            )

    def get_strategy(self):
        return {
            k: v.get_average_strategy()
            for k, v in self.info_sets.items()
        }

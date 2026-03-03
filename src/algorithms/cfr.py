from .info_set import InformationSet


class CFR:
    """
    Counterfactual Regret Minimization (CFR) implementation.
    """

    def __init__(self, game):
        self.game = game
        self.info_sets = {}

    def get_info_set(self, info_set_key, num_actions):
        """Get or create an information set."""
        if info_set_key not in self.info_sets:
            self.info_sets[info_set_key] = InformationSet(num_actions)
        return self.info_sets[info_set_key]

    def train(self, iterations):
        """Train the CFR algorithm."""
        pass

    def cfr(self, player, reach_prob_player, reach_prob_opponent):
        """Recursive CFR algorithm."""
        pass

    def get_strategy(self):
        """Get the computed average strategy for all information sets."""
        pass


class CFR_Node:

    def __init__(self, history = None):
        self.history = history
        self.choices = []
from .cfr import CFR


class MCCFR(CFR):
    """
    Monte Carlo Counterfactual Regret Minimization (MCCFR).
    """

    def __init__(self, game):
        super().__init__(game)

    def train(self, iterations):
        """Train the MCCFR algorithm with sampling."""
        pass


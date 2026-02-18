class InformationSet:
    """
    Represents an information set in CFR.
    """

    def __init__(self, num_actions):
        self.num_actions = num_actions
        self.regret_sum = [0.0] * num_actions
        self.strategy_sum = [0.0] * num_actions

    def get_strategy(self, realization_weight=1.0):
        """Get current strategy using regret matching."""
        pass

    def get_average_strategy(self):
        """Get the average strategy across all iterations."""
        pass


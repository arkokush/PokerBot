class InformationSet:
    """
    Represents an information set in CFR.
    """

    def __init__(self, actions):
        self.actions = actions
        self.num_actions = len(actions)
        self.regret_sum = [0.0] * self.num_actions
        self.strategy_sum = [0.0] * self.num_actions

    def get_strategy(self, realization_weight=1.0):
        """Get current strategy using regret matching."""
        normalizing_sum = 0.0
        strategy = [0.0] * self.num_actions

        for i in range(self.num_actions):
            strategy[i] = max(0.0, self.regret_sum[i])
            normalizing_sum += strategy[i]

        for i in range(self.num_actions):
            if normalizing_sum > 0:
                strategy[i] /= normalizing_sum
            else:
                strategy[i] = 1.0 / self.num_actions
            self.strategy_sum[i] += realization_weight * strategy[i]

        return strategy

    def get_average_strategy(self):
        """Get the average strategy across all iterations."""
        avg_strategy = [0.0] * self.num_actions
        normalizing_sum = sum(self.strategy_sum)

        for i in range(self.num_actions):
            if normalizing_sum > 0:
                avg_strategy[i] = self.strategy_sum[i] / normalizing_sum
            else:
                avg_strategy[i] = 1.0 / self.num_actions

        return avg_strategy



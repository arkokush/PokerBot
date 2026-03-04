class InformationSet:
    def __init__(self, num_actions: int):
        self.num_actions = num_actions
        self.regret_sum = [0.0] * self.num_actions
        self.strategy_sum = [0.0] * self.num_actions

    def get_strategy(self) -> list[float]:
        """
        Get current strategy via Regret Matching.
        Used during training traversal.
        """
        strategy = [max(0.0, r) for r in self.regret_sum]
        total = sum(strategy)

        if total > 0:
            return [s / total for s in strategy]

        return [1.0 / self.num_actions] * self.num_actions

    def get_average_strategy(self) -> list[float]:
        """
        Get the accumulated average strategy.
        This is the Nash Equilibrium approximation.
        """
        total = sum(self.strategy_sum)

        if total > 0:
            return [s / total for s in self.strategy_sum]

        return [1.0 / self.num_actions] * self.num_actions

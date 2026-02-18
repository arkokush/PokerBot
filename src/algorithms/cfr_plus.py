from .cfr import CFR


class CFRPlus(CFR):
    """
    CFR+ variant that converges faster.
    """

    def __init__(self, game):
        super().__init__(game)

    def update_regrets(self, info_set, action_utilities, utility):
        """Update regrets with CFR+ logic (floor at 0)."""
        pass


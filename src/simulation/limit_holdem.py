from src.simulation.base import PokerGame


class LimitHoldem(PokerGame):
    """
    Limit Texas Hold'em implementation (placeholder).

    NOTE: This simulation is not implemented. See the training-side code
    under src/training/ (and src/algorithms/ for the CFR machinery) for the
    implemented games; for a playable Hold'em simulation use
    src/simulation/nl_holdem.py.
    """

    def __init__(self, players, small_bet, big_bet):
        super().__init__(players)
        self.small_bet = small_bet
        self.big_bet = big_bet

    def startRound(self):
        raise NotImplementedError(
            "LimitHoldem.startRound is not implemented; see the training-side "
            "implementations under src/training/ (or use NLHoldem in "
            "src/simulation/nl_holdem.py)."
        )

    def bettingRound(self, *args, **kwargs):
        raise NotImplementedError(
            "LimitHoldem.bettingRound is not implemented; see the training-side "
            "implementations under src/training/ (or use NLHoldem in "
            "src/simulation/nl_holdem.py)."
        )

    def getWinner(self, *args, **kwargs):
        raise NotImplementedError(
            "LimitHoldem.getWinner is not implemented; see the training-side "
            "implementations under src/training/ (or use NLHoldem in "
            "src/simulation/nl_holdem.py)."
        )

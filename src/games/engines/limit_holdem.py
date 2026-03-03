from .base import PokerGame


class LimitHoldem(PokerGame):
    """
    Limit Texas Hold'em implementation (placeholder).
    """

    def __init__(self, players, small_bet, big_bet):
        super().__init__(players)
        self.small_bet = small_bet
        self.big_bet = big_bet

    def startRound(self):
        pass

    def bettingRound(self, *args, **kwargs):
        pass

    def getWinner(self, *args, **kwargs):
        pass


from .base import PokerGame


class LeducPoker(PokerGame):
    """
    Leduc Poker implementation (placeholder).

    Leduc Poker features:
    - 6 cards: 2 Jacks, 2 Queens, 2 Kings
    - 2 players
    - 2 betting rounds
    - Each player gets 1 private card, 1 community card dealt after first round
    """

    def __init__(self, players):
        if len(players) != 2:
            raise ValueError("Leduc Poker requires exactly 2 players")
        super().__init__(players)

    def startRound(self):
        pass

    def bettingRound(self, *args, **kwargs):
        pass

    def getWinner(self, *args, **kwargs):
        pass


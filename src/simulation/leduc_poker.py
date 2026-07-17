from src.simulation.base import PokerGame


class LeducPoker(PokerGame):
    """
    Leduc Poker implementation (placeholder).

    Leduc Poker features:
    - 6 cards: 2 Jacks, 2 Queens, 2 Kings
    - 2 players
    - 2 betting rounds
    - Each player gets 1 private card, 1 community card dealt after first round

    NOTE: This simulation is not implemented. The playable Leduc game tree
    lives on the training side — see `src.training.leduc_poker` (CFR
    training entry point) and `src.algorithms.cfr` for the implementation.
    """

    def __init__(self, players):
        if len(players) != 2:
            raise ValueError("Leduc Poker requires exactly 2 players")
        super().__init__(players)

    def startRound(self):
        raise NotImplementedError(
            "LeducPoker.startRound is not implemented; use the training-side "
            "implementation in src/training/leduc_poker.py (src.training.leduc_poker)."
        )

    def bettingRound(self, *args, **kwargs):
        raise NotImplementedError(
            "LeducPoker.bettingRound is not implemented; use the training-side "
            "implementation in src/training/leduc_poker.py (src.training.leduc_poker)."
        )

    def getWinner(self, *args, **kwargs):
        raise NotImplementedError(
            "LeducPoker.getWinner is not implemented; use the training-side "
            "implementation in src/training/leduc_poker.py (src.training.leduc_poker)."
        )

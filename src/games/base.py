from abc import ABC, abstractmethod


class PokerGame(ABC):
    """
    Abstract base class for poker game variants.
    Each variant must implement these methods.
    """

    def __init__(self, players):
        """
        Initialize the game with a list of players.

        Args:
            players: List of Player objects
        """
        self.players = players
        self.num_players = len(players)
        self.pot = 0

    @abstractmethod
    def startRound(self):
        """
        Start a new round of the game.
        This includes dealing cards, betting rounds, and determining winners.
        """
        pass

    @abstractmethod
    def bettingRound(self, *args, **kwargs):
        """
        Execute a betting round.

        Args can vary based on game variant.
        """
        pass

    @abstractmethod
    def getWinner(self, *args, **kwargs):
        """
        Determine the winner(s) of the current round and distribute the pot.
        """
        pass

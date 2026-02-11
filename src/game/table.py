# Import game variants
from variants.base_game import Game as BaseGame
from variants.nlholdem import NLHoldemGame
from variants.kuhn_poker import KuhnPokerGame

# Backward compatibility: Game class defaults to NLHoldemGame
class Game(NLHoldemGame):
    """
    Default Game class for backward compatibility.
    Uses No Limit Texas Hold'em.
    """
    def __init__(self, players, BIGBLIND_BET):
        super().__init__(players, BIGBLIND_BET)


# Export all game variants
__all__ = ['Game', 'BaseGame', 'NLHoldemGame', 'KuhnPokerGame']



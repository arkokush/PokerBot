import random

from src.training.base import PokerGameRules


class KuhnPokerRules(PokerGameRules):
    """
    P = Pass/Fold
    B = Bet/Call
    """
    def deal_cards(self) -> tuple:
        """
        Deal two cards for Kuhn Poker.

        Returns:
            (card1, card2) where cards are integers:
            0 = Jack, 1 = Queen, 2 = King
        """
        cards = [0, 1, 2]
        random.shuffle(cards)
        return (cards[0], cards[1])

    def is_terminal(self, history: str) -> bool:
        """
        Check if game has ended.

        """
        return history in {'PP', 'BP', 'BB', 'PBP', 'PBB'}

    def get_payoff(self, player_cards: tuple, history: str, player: int, com_cards: tuple = None) -> float:
        """
        Get payoff for a terminal state.

        """
        card1, card2 = player_cards

        if history == 'PP':
            payoff = 1 if card1 > card2 else -1
        elif history == 'BP':
            payoff = 1
        elif history == 'BB':
            payoff = 2 if card1 > card2 else -2
        elif history == 'PBP':
            payoff = -1
        elif history == 'PBB':
            payoff = 2 if card1 > card2 else -2
        else:
            raise ValueError(f"Invalid history: {history}")

        return payoff if player == 0 else -payoff

    def get_info_set_string(self, player_card: tuple, history: str, other_info: tuple = None) -> str:
        """
        Create info set identifier.
        """
        card_names = {0: 'J', 1: 'Q', 2: 'K'}
        return f"{card_names[player_card]}:{history}"

    def get_num_actions(self) -> int:
        """
        How many actions are available?
        """
        return 2

    def get_legal_actions(self, history: str) -> [str]:
        """
        Get legal actions at this point.
        """
        return ['P', 'B']
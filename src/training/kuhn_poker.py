import random
from src.training.base import PokerGameRules


class KuhnPokerRules(PokerGameRules):
    """
    Kuhn Poker Rules:
    Deck: 3 cards (J=0, Q=1, K=2)
    Actions: P (Pass/Fold), B (Bet/Call)
    """

    def deal_cards(self) -> tuple[int, int]:
        cards = [0, 1, 2]
        random.shuffle(cards)
        return cards[0], cards[1]

    def is_terminal(self, history: str) -> bool:
        return history in {"PP", "BP", "BB", "PBP", "PBB"}

    def get_payoff(self, player_cards: tuple[int, int], history: str, com_cards: tuple = None) -> float:
        """
        Returns payoff from PLAYER 0's perspective.
        CFR loop handles flipping this for Player 1.
        """
        card0, card1 = player_cards

        if history == "PP":
            return 1.0 if card0 > card1 else -1.0
        elif history == "BP":
            return 1.0  # P1 folded to P0 bet
        elif history == "BB":
            return 2.0 if card0 > card1 else -2.0
        elif history == "PBP":
            return -1.0 # P0 folded to P1 bet
        elif history == "PBB":
            return 2.0 if card0 > card1 else -2.0

        raise ValueError(f"Invalid history: {history}")

    def get_info_set_string(self, player_card: int, history: str, com_cards: tuple = None) -> str:
        card_names = {0: 'J', 1: 'Q', 2: 'K'}
        return f"{card_names[player_card]}:{history}"

    def get_legal_actions(self, history: str) -> list[str]:
        return ['P', 'B']

    def get_num_actions(self) -> int:
        return 2

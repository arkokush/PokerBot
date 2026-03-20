import random
from src.training.base import PokerGameRules


class LeducPokerRules(PokerGameRules):
    """
    Leduc Poker Rules:
    Deck: 6 cards (J=0,1, Q=2,3, K=4,5)

    """

    def deal_cards(self) -> tuple[int, int, int]:
        cards = [0, 1, 2, 3, 4, 5]
        random.shuffle(cards)
        return cards[0], cards[1], cards[2]

    def is_terminal(self, history: str) -> bool:
        rounds = history.split("/")
        r1 = rounds[0]
        r2 = rounds[1] if len(rounds) > 1 else ""

        if r1.endswith("F"):
            return True

        if not self._round_terminal(r1):
            return False

        if r2 == "":
            return False

        return self._round_terminal(r2)

    def _round_terminal(self, r: str) -> bool:
        return (
            r.endswith("F") or   # fold
            r.endswith("C") or   # call ends betting
            r == "PP"            # check-check
        )

    def get_payoff(self, player_cards: tuple[int, int], history: str, com_cards: tuple[int]) -> float:
        """
        Returns payoff from PLAYER 0's perspective.
        CFR loop handles flipping this for Player 1.
        """
        card0, card1 = player_cards
        board = com_cards[0]

        rounds = history.split("/")
        r1 = rounds[0]
        r2 = rounds[1] if len(rounds) > 1 else ""

        pot = self.get_pot(history)

        if r2 == "":
            if r1[-1] != "F":
                raise ValueError(f"Invalid history: {history}")
            return pot if len(r1) % 2 == 0 else -pot

        if r2[-1] == "F":
            return pot if len(r2) % 2 == 0 else -pot

        hand_rank {
        "02": 0, "20": 0, "12": 0, "21": 0, "03" : 0, "30" : 0, "13": 0, "31" : 0,
        "04": 1, "40": 1, "14": 1, "41": 1, "05" : 1, "50" : 1, "15": 1, "51" : 1,
        "24": 2, "42": 2, "34": 2, "43": 2, "25" : 2, "52" : 2, "35": 2, "53" : 2,
        "01": 3, "10": 3,
        "23": 3, "32": 4,
        "45": 3, "54": 5,
        }

        rank0 = hand_rank[f"{card0}{board}"]
        rank1 = hand_rank[f"{card1}{board}"]

        if(rank0 > rank1):
            return pot
        elif(rank0 == rank1):
            return 0
        elif(rank0 < rank1):
            return -pot

        raise ValueError(f"Invalid history: {history}")

    def get_info_set_string(self, player_card: int, history: str, com_cards: tuple[int]) -> str:
        card_names = {0: 'J', 1: 'Q', 2: 'K'}
        return f"{card_names[player_card//2]}|{card_names[com_cards[0]//2]}:{history}"

    def get_legal_actions(self, history: str) -> list[str]:
        return ['P', 'B']

    def get_num_actions(self) -> int:
        return 2

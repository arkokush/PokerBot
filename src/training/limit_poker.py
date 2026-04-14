import random
from src.training.base import PokerGameRules


class LimitPokerRules(PokerGameRules):
    """
    Limit Poker Rules:
    Deck: 52 Cards, //4 = Val, %4 = Suit
    F = Fold, P = Pass/Check, C = Call, B = Bet, R = Raise
    """

    def deal_cards(self) -> tuple:
        cards = random.sample(range(52), 9)
        return (cards[0], cards[1]), (cards[2], cards[3]), (cards[4], cards[5], cards[6], cards[7], cards[8])

    def is_terminal(self, history: str) -> bool:
        rounds = history.split("//")

        for i, r in enumerate(rounds):
            if r == "":
                return False
            if r.endswith("F"):
                return True
            if not self._is_round_complete(r, is_preflop=(i == 0)):
                return False

        return len(rounds) == 4

    def _is_round_complete(self, r: str, is_preflop: bool = False) -> bool:
        if r == "":
            return False
        if r.endswith("F"):
            return True
        if r.endswith("C") and len(r) >= 2:
            return True
        if r == "PP":
            return True
        if is_preflop and r == "CP":
            return True  # limp, big blind checks
        return False

    def get_payoff(self, player_cards: tuple[int, int], history: str, com_cards: tuple[int]) -> float:
        """
        Returns payoff from PLAYER 0's perspective.
        CFR loop handles flipping this for Player 1.
        """

        if not self.is_terminal(history):
            raise ValueError(f"Invalid history: {history}")

        card0, card1 = player_cards
        board = com_cards[0]

        rounds = history.split("//")
        r1 = rounds[0]
        r2 = rounds[1] if len(rounds) > 1 else ""

        pot = self._calculate_pot(history)

        if r2 == "":
            if r1[-1] != "F":
                raise ValueError(f"Invalid history: {history}")
            return pot if len(r1) % 2 == 0 else -pot

        if r2[-1] == "F":
            return pot if len(r2) % 2 == 0 else -pot

        hand_rank = {
        "02": 0, "20": 0, "12": 0, "21": 0, "03" : 0, "30" : 0, "13": 0, "31" : 0,
        "04": 1, "40": 1, "14": 1, "41": 1, "05" : 1, "50" : 1, "15": 1, "51" : 1,
        "24": 2, "42": 2, "34": 2, "43": 2, "25" : 2, "52" : 2, "35": 2, "53" : 2,
        "01": 3, "10": 3,
        "23": 4, "32": 4,
        "45": 5, "54": 5,
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

    def _calculate_pot(self, history: str) -> int:
        """
        Calculate pot by simulating betting action by action.

        This handles all edge cases correctly.
        """
        pot = 2  # Antes

        if '/' not in history:
            rounds = [history]
        else:
            rounds = history.split('//')

        for round_idx, round_history in enumerate(rounds):
            bet_size = 2 if round_idx == 0 else 4

            commitment = [0, 0]
            current_bet = 0

            for action_idx, action in enumerate(round_history):
                player = action_idx % 2

                if action == 'B':
                    current_bet = bet_size
                    commitment[player] = current_bet

                elif action == 'R':
                    current_bet += bet_size
                    commitment[player] = current_bet

                elif action == 'C':
                    commitment[player] = current_bet

                elif action == 'F':
                    pass

            pot += sum(commitment)

        return pot

    def get_info_set_string(self, player_card: int, history: str, com_cards: tuple[int]) -> str:
        card_names = {0: 'J', 1: 'Q', 2: 'K'}
        rounds = history.count('//')
        if rounds == 0:
            return f"{card_names[player_card//2]}:{history}"
        return f"{card_names[player_card//2]}|{card_names[com_cards[0]//2]}:{history}"

    def get_legal_actions(self, history: str) -> list[str]:
        rounds = history.split("//")
        r1 = rounds[0]
        r2 = rounds[1] if len(rounds) > 1 else None

        # Between rounds: transition to round 2 by appending separator
        if r2 is None and self._round_terminal(r1):
            return ["//"]

        current_round = rounds[-1]

        if current_round == "":
            return ['P', 'B']

        prev = current_round[-1]
        if prev == 'P':
            return ['P', 'B']
        elif prev == 'B':
            return ['F', 'C', 'R']
        elif prev == 'R':
            if len(current_round) >= 2 and current_round[-2] == 'R':
                return ['F', 'C']
            return ['F', 'C', 'R']
        return []

    def get_num_actions(self) -> int:
        return 5

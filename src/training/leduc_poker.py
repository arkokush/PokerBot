import random
from src.training.base import PokerGameRules


class LeducPokerRules(PokerGameRules):
    """
    Leduc Poker Rules:
    Deck: 6 cards (J=0,1, Q=2,3, K=4,5)
    F = Fold, P = Pass/Check, C = Call, B = Bet, R = Raise
    """

    def deal_cards(self) -> tuple[int, int, int]:
        cards = [0, 1, 2, 3, 4, 5]
        random.shuffle(cards)
        return cards[0], cards[1], cards[2]

    def is_terminal(self, history: str) -> bool:
        rounds = history.split("//")
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

    def get_payoff(self, player_cards, history, com_cards) -> float:
        if not self.is_terminal(history):
            raise ValueError(f"Invalid history: {history}")

        card0, card1 = player_cards
        board = com_cards[0]
        rounds = history.split("//")
        r1 = rounds[0]
        r2 = rounds[1] if len(rounds) > 1 else ""

        commitments = self._calculate_commitments(history)

        if r2 == "":
            folder = len(r1) - 1
            if folder % 2 == 0:
                return -commitments[0]
            else:
                return commitments[1]

        if r2.endswith("F"):
            folder = len(r2) - 1
            if folder % 2 == 0:
                return -commitments[0]
            else:
                return commitments[1]

        hand_rank = {
            "02": 0, "20": 0, "12": 0, "21": 0, "03": 0, "30": 0, "13": 0, "31": 0,
            "04": 1, "40": 1, "14": 1, "41": 1, "05": 1, "50": 1, "15": 1, "51": 1,
            "24": 2, "42": 2, "34": 2, "43": 2, "25": 2, "52": 2, "35": 2, "53": 2,
            "01": 3, "10": 3,
            "23": 4, "32": 4,
            "45": 5, "54": 5,
        }

        rank0 = hand_rank[f"{card0}{board}"]
        rank1 = hand_rank[f"{card1}{board}"]

        if rank0 > rank1:
            return commitments[1]
        elif rank0 < rank1:
            return -commitments[0]
        else:
            return 0

    def _calculate_commitments(self, history: str) -> list:
        rounds = history.split("//") if "//" in history else [history]
        commitments = [1, 1]  # antes

        for round_idx, round_history in enumerate(rounds):
            bet_size = 2 if round_idx == 0 else 4
            commit = [0, 0]
            current_bet = 0

            for action_idx, action in enumerate(round_history):
                player = action_idx % 2

                if action == 'B':
                    current_bet = bet_size
                    commit[player] = current_bet
                elif action == 'R':
                    current_bet += bet_size
                    commit[player] = current_bet
                elif action == 'C':
                    commit[player] = current_bet

            commitments[0] += commit[0]
            commitments[1] += commit[1]

        return commitments

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

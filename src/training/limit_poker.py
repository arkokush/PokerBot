import random
from src.training.base import PokerGameRules
from phevaluator.evaluator import evaluate_cards

class LimitPokerRules(PokerGameRules):
    """
    Limit Poker Rules:
    Deck: 52 Cards, //4 = Val, %4 = Suit
    F = Fold, P = Pass/Check, C = Call, B = Bet, R = Raise
    """

    rank_map = {
        0: "2", 1: "3", 2: "4", 3: "5", 4: "6", 5: "7", 6: "8", 7: "9",
        8: "T", 9: "J", 10: "Q", 11: "K", 12: "A",
    }

    suit_map = {
        0: "c", 1: "d", 2: "h", 3: "s",
    }


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

    def get_payoff(self, player_cards, history, com_cards) -> float:
        if not self.is_terminal(history):
            raise ValueError(f"Invalid history: {history}")

        cards0, cards1 = player_cards
        commitments = self._calculate_commitments(history)

        rounds = history.split("//")
        for r_idx, r in enumerate(rounds):
            if r.endswith("F"):
                if r_idx == 0:
                    folder = (len(r) - 1 + 1) % 2
                else:
                    folder = (len(r) - 1) % 2
                return -commitments[0] if folder == 0 else commitments[1]

        rank0 = self._evaluate(cards0, com_cards)
        rank1 = self._evaluate(cards1, com_cards)

        if rank0 > rank1:
            return commitments[1]
        elif rank0 < rank1:
            return -commitments[0]
        else:
            return 0

    def _calculate_commitments(self, history: str) -> list:
        rounds = history.split("//") if "//" in history else [history]
        commitments = [1, 1]  # antes + BB represented as forced bet

        for round_idx, round_history in enumerate(rounds):
            bet_size = 2 if round_idx <= 1 else 4
            commit = [0, 0]
            current_bet = 0

            if round_idx == 0:
                commit[0] = 1
                current_bet = 1

            for action_idx, action in enumerate(round_history):
                if round_idx == 0:
                    player = (action_idx + 1) % 2
                else:
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

    def _get_card(self, card: int):
        return f"{rank_map[card // 4]}{suit_map[card % 4]}"

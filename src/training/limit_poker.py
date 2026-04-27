import random
from src.training.base import PokerGameRules
from src.utils.cards import rank_reverse_map, suit_reverse_map
from src.utils.equity import preflop_key, mc_win_prob, river_win_prob, equity_bucket, load_preflop_equity
from phevaluator.evaluator import evaluate_cards

class LimitPokerRules(PokerGameRules):
    """
    Limit Poker Rules:
    Deck: 52 Cards, //4 = Val, %4 = Suit
    F = Fold, P = Pass/Check, C = Call, B = Bet, R = Raise
    """

    NUM_BUCKETS = 8
    MC_SAMPLES = 100  # rollouts per node for flop/turn equity estimation

    def __init__(self):
        self._preflop_equity = load_preflop_equity()


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
                    folder = len(r) % 2  # player 1 acts first preflop
                else:
                    folder = (len(r) - 1) % 2
                return -commitments[0] if folder == 0 else commitments[1]

        rank0 = self._evaluate(cards0, com_cards)
        rank1 = self._evaluate(cards1, com_cards)

        # phevaluator: lower rank = stronger hand
        if rank0 < rank1:
            return commitments[1]
        elif rank0 > rank1:
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
                    player = (action_idx + 1) % 2  # player 1 acts first preflop
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

    def get_info_set_string(self, player_card: tuple, history: str, com_cards: tuple) -> str:
        street = history.count('//')
        community = com_cards[0] if com_cards[0] is not None else ()

        if street == 0:
            win_prob = self._preflop_equity[preflop_key(*player_card)]
        elif street == 1:
            win_prob = mc_win_prob(player_card, community[:3], self.MC_SAMPLES)
        elif street == 2:
            win_prob = mc_win_prob(player_card, community[:4], self.MC_SAMPLES)
        else:
            win_prob = river_win_prob(player_card, community[:5])

        bucket = equity_bucket(win_prob, self.NUM_BUCKETS)
        return f"b{bucket}:{history}"

    def get_acting_player(self, history: str) -> int:
        rounds = history.split("//")
        current_round_len = len(rounds[-1])
        if len(rounds) == 1:
            return (current_round_len + 1) % 2  # player 1 (BTN/SB) acts first preflop
        return current_round_len % 2  # player 0 (BB) acts first all other streets

    def get_legal_actions(self, history: str) -> list[str]:
        rounds = history.split("//")
        current_round = rounds[-1]
        is_preflop = len(rounds) == 1

        # Transition to next street if current round is complete and game isn't over
        if len(rounds) < 4 and self._is_round_complete(current_round, is_preflop=is_preflop):
            return ["//"]

        if current_round == "":
            return ['P', 'B']

        prev = current_round[-1]
        raise_count = current_round.count('R')

        if prev == 'P':
            return ['P', 'B']
        elif prev == 'B':
            if raise_count >= 3:
                return ['F', 'C']
            return ['F', 'C', 'R']
        elif prev == 'R':
            if raise_count >= 3:
                return ['F', 'C']
            return ['F', 'C', 'R']
        return []

    def get_num_actions(self) -> int:
        return 5

    def _evaluate(self, hole_cards: tuple, com_cards: tuple) -> int:
        community = com_cards[0]
        cards = [self._get_card(c) for c in hole_cards] + [self._get_card(c) for c in community]
        return evaluate_cards(*cards)

    def _get_card(self, card: int) -> str:
        return f"{rank_reverse_map[card // 4]}{suit_reverse_map[card % 4]}"

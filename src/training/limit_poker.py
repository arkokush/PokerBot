import random
from src.training.base import PokerGameRules
from src.utils.cards import rank_reverse_map, suit_reverse_map
from src.utils.equity import preflop_key, mc_win_prob, river_win_prob, equity_bucket, load_preflop_equity
from phevaluator.evaluator import evaluate_cards

class LimitPokerRules(PokerGameRules):
    """
    Heads-up Limit Texas Hold'em.

    Deck: 52 cards, card_id // 4 = rank, card_id % 4 = suit.
    Player 1 is the button/small blind (posts 1, acts FIRST preflop).
    Player 0 is the big blind (posts 2, acts first on every later street).
    Bet size is 2 preflop and on the flop, 4 on the turn and river; each
    round is capped at 4 total bets (preflop: the blind + 3 raises).

    KEY GRAMMAR (this is the contract mirrored by the web bot's key builder
    in web/src/bots/mccfr.ts — keep the two in sync):

      Info-set key:  "b{bucket}:{history}"  with NUM_BUCKETS equity buckets
      (preflop bucket from the precomputed 169-hand equity table, flop/turn
      from Monte Carlo rollouts, river exact).

      Preflop (SB acts first, facing the blind as a live bet):
        F = fold, C = call (including the opening limp), R = raise,
        P = the big blind CHECKING their option after a limp
        -> a limp-check round is exactly "CP"; a closing call ends the
           round (e.g. "RC"); the opening limp "C" does NOT end it.
      Postflop (BB acts first):
        P = check, B = bet, C = call, R = raise, F = fold
        -> rounds end on "PP", or a call closing the action, or a fold.
      "//" is appended whenever a round completes and play continues, so
      start-of-street info sets end in "//" (e.g. "b7:CP//").
      Example histories: "", "C", "CP//", "CR", "R", "RC//", "CRR",
      "CP//PB", "CP//PBC//".
    """

    NUM_BUCKETS = 20  # must match LIMIT_BUCKETS in web/src/bots/mccfr.ts
    MC_SAMPLES = 200  # rollouts per node for flop/turn equity estimation

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
        """Total chips committed by [player0 (BB), player1 (SB)]."""
        rounds = history.split("//") if "//" in history else [history]
        commitments = [0, 0]

        for round_idx, round_history in enumerate(rounds):
            bet_size = 2 if round_idx <= 1 else 4

            if round_idx == 0:
                # Blinds: player 0 (BB) has 2 in, player 1 (SB) has 1 in;
                # the big blind is the live bet to match.
                commit = [2, 1]
                current_bet = 2
            else:
                commit = [0, 0]
                current_bet = 0

            for action_idx, action in enumerate(round_history):
                if round_idx == 0:
                    player = (action_idx + 1) % 2  # player 1 (SB) acts first preflop
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
                # 'P' (check) and 'F' (fold) add nothing.

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

        prev = current_round[-1] if current_round else ""
        raise_count = current_round.count('R')

        if is_preflop:
            # SB faces the big blind as a live bet: fold, call (limp) or
            # raise. After a limp the BB may check their option (ending the
            # round as "CP") or raise. The blind counts as the first bet, so
            # the cap allows 3 raises.
            if current_round == "":
                return ['F', 'C', 'R']
            if current_round == "C":
                return ['P', 'R']
            if prev == 'R':
                if raise_count >= 3:
                    return ['F', 'C']
                return ['F', 'C', 'R']
            return []

        if current_round == "":
            return ['P', 'B']

        if prev == 'P':
            return ['P', 'B']
        elif prev == 'B' or prev == 'R':
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

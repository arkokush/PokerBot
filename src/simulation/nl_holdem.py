import warnings

from src.simulation.base import PokerGame
from src.utils.cards import Deck
from phevaluator.evaluator import evaluate_cards


class NLHoldem(PokerGame):
    """
    No Limit Texas Hold'em implementation.

    Betting-round invariant:
        A betting round ends when every non-folded, non-all-in player has
        either matched the current bet or checked, and everyone owed an
        action since the last full raise has acted. This is tracked with an
        explicit per-player ``needs_action`` flag (plus a ``may_raise`` flag
        implementing the NLHE rule that an all-in raise smaller than a full
        min-raise does NOT re-open betting for players who already acted,
        and does not reset the min-raise increment).

    Illegal-action policy (documented, deliberate):
        * "Check" while facing a bet, an unparseable "Raise", or any
          unrecognized action string is treated as a FOLD after a warning.
          Chips are never taken involuntarily and the loop cannot spin.
        * A "Raise" from a player whose action was not re-opened (short
          all-in ahead of them) is downgraded to a CALL after a warning.
        * A "Call" for more than the player's stack is an all-in for less.

    Heads-up blinds: the button posts the SMALL blind and acts first
    preflop; the other player posts the big blind and acts first postflop.
    """

    def __init__(self, players, big_blind):
        super().__init__(players)
        self.BIGBLIND_BET = big_blind
        self.community_cards = []
        self.current_bet = 0
        self.dealer_index = None  # set to 0 on the first hand, then rotates
        self.deck = Deck()
        # Total chips each seat has put into the pot this hand (for side pots).
        self.contributions = [0] * self.num_players

    # ------------------------------------------------------------------ #
    # Hand flow
    # ------------------------------------------------------------------ #

    def startRound(self):
        self.deck = Deck()
        self.deck.shuffle()
        self.community_cards = []
        self.current_bet = 0
        self.pot = 0
        self.contributions = [0] * self.num_players

        # First hand: dealer is seat 0. Afterwards the button rotates.
        if self.dealer_index is None:
            self.dealer_index = 0
        else:
            self.dealer_index = (self.dealer_index + 1) % self.num_players

        for player in self.players:
            player.reset_for_new_round()
            player.getCards(self.deck.deal(2))

        n = self.num_players
        if n == 2:
            # Heads-up: button posts the small blind and acts first preflop;
            # the other player posts the big blind and acts first postflop.
            sb_index = self.dealer_index
            bb_index = (self.dealer_index + 1) % n
            preflop_start = sb_index
            postflop_start = bb_index
        else:
            sb_index = (self.dealer_index + 1) % n
            bb_index = (self.dealer_index + 2) % n
            preflop_start = (self.dealer_index + 3) % n
            postflop_start = sb_index

        self._post(sb_index, min(self.BIGBLIND_BET // 2,
                                 self.players[sb_index].stack))
        self._post(bb_index, min(self.BIGBLIND_BET,
                                 self.players[bb_index].stack))

        # The amount to call preflop is the full big blind even if the big
        # blind posted all-in for less (standard TDA rule).
        self.current_bet = self.BIGBLIND_BET

        self.bettingRound(preflop_start, self.BIGBLIND_BET)
        if self._award_if_uncontested():
            return

        for street_size in (3, 1, 1):
            self._reset_bets_for_new_street()
            self.community_cards.extend(self.deck.deal(street_size))
            self.bettingRound(postflop_start, self.BIGBLIND_BET)
            if self._award_if_uncontested():
                return

        self.getWinner(self.community_cards, self.players, self.pot)

    def _post(self, player_index, amount):
        """Move `amount` chips from a player to the pot, tracking contribution."""
        paid = self.players[player_index].bet(amount)
        self.pot += paid
        self.contributions[player_index] += paid
        return paid

    def _reset_bets_for_new_street(self):
        self.current_bet = 0
        for player in self.players:
            player.current_bet = 0

    def _award_if_uncontested(self):
        """If only one player remains un-folded, award them the pot."""
        remaining = [p for p in self.players if not p.folded]
        if len(remaining) == 1:
            remaining[0].buy_in(self.pot)
            self.pot = 0
            return True
        return False

    # ------------------------------------------------------------------ #
    # Betting round
    # ------------------------------------------------------------------ #

    def bettingRound(self, starting_index, min_raise):
        n = self.num_players
        cur_bet = self.current_bet

        # needs_action[i]: seat i is owed an action before the round can end.
        # may_raise[i]: seat i is allowed to raise (re-set on a full raise;
        # NOT re-set by a short all-in raise).
        needs_action = [not (p.folded or p.all_in) for p in self.players]
        may_raise = [True] * n

        i = starting_index % n
        while any(needs_action):
            if sum(1 for p in self.players if not p.folded) <= 1:
                break

            if not needs_action[i]:
                i = (i + 1) % n
                continue

            player = self.players[i]
            call_amnt = cur_bet - player.current_bet

            player_state = {
                "hand": player.hand,
                "current_bet": player.current_bet,
                "player_stack": player.stack,
                "community_cards": self.community_cards,
                "call_amnt": call_amnt,
                "min_raise": min_raise,
                "players_left": sum(1 for p in self.players if not p.folded),
                "may_raise": may_raise[i],
            }

            decision = player.decide(player_state)
            action = decision.split()[0] if isinstance(decision, str) and decision.split() else ""

            if action == "Fold":
                player.fold()

            elif action == "Check":
                if call_amnt > 0:
                    warnings.warn(
                        f"{player.name}: 'Check' while facing a bet of "
                        f"{call_amnt} is illegal; treating as Fold."
                    )
                    player.fold()
                # else: a legal check, nothing to pay.

            elif action == "Call":
                # All-in for less is allowed: pay at most the stack.
                self._post(i, min(call_amnt, player.stack))

            elif action == "Raise":
                handled = self._handle_raise(
                    i, decision, call_amnt, cur_bet, min_raise,
                    needs_action, may_raise,
                )
                if handled is None:
                    # Unparseable raise: treated as fold (warned inside).
                    player.fold()
                else:
                    cur_bet, min_raise = handled

            else:
                warnings.warn(
                    f"{player.name}: unrecognized action {decision!r}; "
                    f"treating as Fold."
                )
                player.fold()

            needs_action[i] = False
            may_raise[i] = False
            i = (i + 1) % n

        self.current_bet = cur_bet
        return min_raise

    def _handle_raise(self, i, decision, call_amnt, cur_bet, min_raise,
                      needs_action, may_raise):
        """
        Process a raise from seat i. Returns (new_cur_bet, new_min_raise),
        or None if the decision string is unparseable (caller folds them).
        """
        player = self.players[i]

        try:
            amount = int(decision.split()[1])
            if amount <= 0:
                raise ValueError
        except (IndexError, ValueError):
            warnings.warn(
                f"{player.name}: unparseable raise {decision!r}; "
                f"treating as Fold."
            )
            return None

        if not may_raise[i]:
            # Action was not re-opened for this player (short all-in ahead):
            # they may only call or fold. Downgrade to a call.
            warnings.warn(
                f"{player.name}: raising is not allowed (action not "
                f"re-opened); treating as Call."
            )
            self._post(i, min(call_amnt, player.stack))
            return cur_bet, min_raise

        # `amount` is the raise increment above the current bet.
        amount = max(amount, min_raise)
        total = call_amnt + amount
        if total >= player.stack:
            total = player.stack  # all-in (possibly for less than a min-raise)

        increment = total - call_amnt
        self._post(i, total)

        if increment >= min_raise:
            # Full raise: re-opens the action for everyone else.
            cur_bet = player.current_bet
            min_raise = increment
            for j in range(self.num_players):
                if j == i:
                    continue
                p = self.players[j]
                if not p.folded and not p.all_in:
                    needs_action[j] = True
                    may_raise[j] = True
        elif player.current_bet > cur_bet:
            # Short all-in raise: raises the amount to call, but does NOT
            # re-open the action (may_raise untouched) and does NOT reset
            # the min-raise increment.
            cur_bet = player.current_bet
            for j in range(self.num_players):
                if j == i:
                    continue
                p = self.players[j]
                if not p.folded and not p.all_in and p.current_bet < cur_bet:
                    needs_action[j] = True
        # else: the "raise" only amounted to an all-in call for less.

        return cur_bet, min_raise

    # ------------------------------------------------------------------ #
    # Showdown / side pots
    # ------------------------------------------------------------------ #

    def getWinner(self, community_cards, players, pot):
        """
        Showdown with proper side pots.

        Each player's total contribution this hand caps how much they can
        win from each other player. The pot is peeled into layers at each
        distinct contribution level; each layer is awarded to the best
        un-folded hand among players who contributed to that layer. Split
        layers use integer division, with odd chips going to the first
        winner left of the button.
        """
        n = len(players)

        ranks = {}
        for idx in range(n):
            if players[idx].folded:
                continue
            ranks[idx] = evaluate_cards(
                str(players[idx].hand[0]),
                str(players[idx].hand[1]),
                *[str(card) for card in community_cards]
            )

        contrib = list(self.contributions)

        while sum(contrib) > 0:
            cap = min(c for c in contrib if c > 0)

            # Players eligible to win this layer: contributed to it and
            # have not folded.
            eligible = [idx for idx in range(n)
                        if contrib[idx] > 0 and idx in ranks]

            layer = 0
            for idx in range(n):
                take = min(contrib[idx], cap)
                layer += take
                contrib[idx] -= take

            if not eligible:
                # Degenerate: only folded players contributed to this layer
                # (cannot normally happen — the last un-folded player is
                # handled by _award_if_uncontested). Give it to the best
                # remaining hand so chips are never destroyed.
                eligible = list(ranks.keys())

            best_rank = min(ranks[idx] for idx in eligible)
            winners = [idx for idx in eligible if ranks[idx] == best_rank]

            # Odd chips go to the first winner left of the button.
            winners.sort(key=lambda idx: (idx - self.dealer_index - 1) % n)
            share = layer // len(winners)
            remainder = layer % len(winners)
            for pos, idx in enumerate(winners):
                players[idx].buy_in(share + (1 if pos < remainder else 0))

        self.pot = 0

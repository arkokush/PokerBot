import warnings

from src.simulation.base import PokerGame
from src.utils.cards import Deck, Card


class KuhnPoker(PokerGame):
    """
    Kuhn Poker implementation.

    Kuhn Poker is a simplified poker game with:
    - 3 cards: King, Queen, Jack
    - 2 players
    - Each player gets 1 card
    - 1 betting round
    - Ante of 1 chip per player
    - Players can check or bet 1 chip

    Illegal-action policy (documented, deliberate):
    - When NOT facing a bet, any response other than "Bet" is treated as
      "Check" (checking is always legal there).
    - When facing a bet, any response other than "Call" is treated as
      "Fold" after a warning, so chips are never taken involuntarily and
      the pot is always awarded.
    - Bets/antes/calls are capped at the player's stack (a player with 0
      chips cannot bet; their "Bet" is treated as a check).
    """

    def __init__(self, players):
        """
        Initialize Kuhn Poker game.

        Args:
            players: List of exactly 2 Player objects
        """
        if len(players) != 2:
            raise ValueError("Kuhn Poker requires exactly 2 players")
        super().__init__(players)

        self.player1, self.player2 = players
        self.pot = 0

    def startRound(self):
        """
        Start a new round of Kuhn Poker.

        Steps:
        1. Reset player state (current_bet/folded flags accumulate otherwise)
        2. Post antes (all-in for less if a stack is short)
        3. Shuffle and deal 1 card to each player
        4. Run betting round
        5. Determine winner (every path awards the pot)
        """
        self.player1.reset_for_new_round()
        self.player2.reset_for_new_round()

        deck = Deck(cards=[Card("Kh"), Card("Qh"), Card("Jh")])

        self.pot = 0
        self.pot += self._safe_bet(self.player1)
        self.pot += self._safe_bet(self.player2)

        deck.shuffle()
        self.player1.hand = deck.deal(1)
        self.player2.hand = deck.deal(1)

        self.bettingRound()

    def _safe_bet(self, player):
        """Bet 1 chip, or the whole (possibly empty) stack if it is short."""
        return player.bet(min(1, player.stack))

    def bettingRound(self):
        """
        Execute a betting round in Kuhn Poker.

        Kuhn Poker has simplified betting:
        - First player can check or bet
        - If check: second player can check (showdown) or bet
        - If bet: second player can fold or call

        Every path through this method ends in getWinner(), so the pot can
        never evaporate. See the class docstring for how invalid agent
        responses are handled.
        """
        player1_state = (1, self.player1.hand, self.player1.stack, self.pot)
        player1_decision = self.player1.decide(player1_state)

        if player1_decision == "Bet" and self.player1.stack >= 1:
            self.pot += self.player1.bet(1)
        else:
            if player1_decision not in ("Check", "Bet"):
                warnings.warn(
                    f"Player 1: invalid action {player1_decision!r} when not "
                    f"facing a bet; treating as Check."
                )
            player1_decision = "Check"

        player2_state = (2, self.player2.hand, self.player2.stack, self.pot, player1_decision)
        player2_decision = self.player2.decide(player2_state)

        if player1_decision == "Bet":
            # Player 2 faces a bet: Call or Fold. Anything else -> Fold.
            if player2_decision == "Call":
                self.pot += self._safe_bet(self.player2)
                self.getWinner()
            else:
                if player2_decision != "Fold":
                    warnings.warn(
                        f"Player 2: invalid action {player2_decision!r} when "
                        f"facing a bet; treating as Fold."
                    )
                self.getWinner(folded=2)
            return

        # Player 1 checked: Player 2 may check (showdown) or bet.
        if player2_decision == "Bet" and self.player2.stack >= 1:
            self.pot += self.player2.bet(1)
        else:
            if player2_decision not in ("Check", "Bet"):
                warnings.warn(
                    f"Player 2: invalid action {player2_decision!r} when not "
                    f"facing a bet; treating as Check."
                )
            self.getWinner()
            return

        # Player 1 faces Player 2's bet: Call or Fold. Anything else -> Fold.
        player1_state = (1, self.player1.hand, self.player1.stack, self.pot, "Bet")
        player1_decision = self.player1.decide(player1_state)

        if player1_decision == "Call":
            self.pot += self._safe_bet(self.player1)
            self.getWinner()
        else:
            if player1_decision != "Fold":
                warnings.warn(
                    f"Player 1: invalid action {player1_decision!r} when "
                    f"facing a bet; treating as Fold."
                )
            self.getWinner(folded=1)

    def getWinner(self, folded = 0):
        """
        Determine the winner of Kuhn Poker.

        Winner is determined by:
        - If one player folded, other player wins
        - If both players are in, highest card wins (K > Q > J)
        """
        if folded == 1:
            self.player2.buy_in(self.pot)
            self.pot = 0
            return 2

        elif folded == 2:
            self.player1.buy_in(self.pot)
            self.pot = 0
            return 1

        else:
            rank_values = {'K': 2, 'Q': 1, 'J': 0}
            player1_rank = self.player1.hand[0].getRank()
            player2_rank = self.player2.hand[0].getRank()

            if rank_values[player1_rank] > rank_values[player2_rank]:
                self.player1.buy_in(self.pot)
                self.pot = 0
                return 1

            else:
                self.player2.buy_in(self.pot)
                self.pot = 0
                return 2

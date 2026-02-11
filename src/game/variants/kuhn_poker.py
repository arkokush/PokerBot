from .base_game import Game
from ..cards import Deck, Card

class KuhnPokerGame(Game):
    """
    Kuhn Poker implementation.

    Kuhn Poker is a simplified poker game with:
    - 3 cards: King, Queen, Jack
    - 2 players
    - Each player gets 1 card
    - 1 betting round
    - Ante of 1 chip per player
    - Players can check or bet 1 chip
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
            1. Reset game state
            2. Shuffle and deal 1 card to each player
            3. Post antes
            4. Run betting round
            5. Determine winner
            """

            deck = Deck(cards=[Card("Kh"), Card("Qh"), Card("Jh")])
            self.pot = 2
            self.player1.stack -= 1
            self.player2.stack -= 1

            deck.shuffle()
            self.player1.hand = deck.deal(1)
            self.player2.hand = deck.deal(1)

            self.bettingRound()







    def bettingRound(self):
        """
        Execute a betting round in Kuhn Poker.

        Kuhn Poker has simplified betting:
        - First player can check or bet
        - If check: second player can check (showdown) or bet
        - If bet: second player can fold or call
        """
        player1_state = (1, self.player1.hand, self.player1.stack, self.pot)
        player1_decision = self.player1.decide(player1_state)

        if player1_decision == "Bet":
            self.pot += 1
            self.player1.stack -= 1

        player2_state = (2, self.player2.hand, self.player2.stack, self.pot, player1_decision)
        player2_decision = self.player2.decide(player2_state)

        if player1_decision == "Bet":
            if player2_decision == "Fold":
                self.getWinner(folded = 2)
                return

            elif player2_decision == "Call":
                self.pot += 1
                self.player2.stack -= 1
                self.getWinner()
                return
        else:
            if player2_decision == "Check":
                self.getWinner()
                return

            elif player2_decision == "Bet":
                self.pot += 1
                self.player2.stack -= 1

                player1_state = (1, self.player1.hand, self.player1.stack, self.pot, player2_decision)
                player1_decision = self.player1.decide(player1_state)

                if player1_decision == "Fold":
                    self.getWinner(folded = 1)
                    return
                elif player1_decision == "Call":
                    self.pot += 1
                    self.player1.stack -= 1
                    self.getWinner()
                    return


    def getWinner(self, folded = 0):
        """
        Determine the winner of Kuhn Poker.

        Winner is determined by:
        - If one player folded, other player wins
        - If both players are in, highest card wins (K > Q > J)
        """
        if folded == 1:
            self.player2.stack += self.pot
            return 2

        elif folded == 2:
            self.player1.stack += self.pot
            return 1

        else:
            rank_values = {'K': 2, 'Q': 1, 'J': 0}
            player1_rank = self.player1.hand[0].getRank()
            player2_rank = self.player2.hand[0].getRank()

            if rank_values[player1_rank] > rank_values[player2_rank]:
                self.player1.stack += self.pot
                return 1

            else:
                self.player2.stack += self.pot
                return 2

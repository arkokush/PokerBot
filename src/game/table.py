from cards import Deck
from phevaluator.evaluator import evaluate_cards

class Game:
    def __init__(self, players, BIGBLIND_BET):
        self.players = players
        self.num_players = len(players)
        self.community_cards = []
        self.pot = 0
        self.current_bet = 0
        self.deck = Deck()
        self.dealer_index = 0
        self.BIGBLIND_BET = BIGBLIND_BET

    def startRound(self):
        self.community_cards = []
        self.dealer_index = (self.dealer_index + 1) % self.num_players
        self.deck.shuffle()
        self.current_bet = self.BIGBLIND_BET
        self.pot = 0

        for player in self.players:
            player.reset_for_new_round()
            player.hand = self.deck.deal(2)

        self.pot += self.players[(self.dealer_index + 1) % self.num_players].bet(self.BIGBLIND_BET//2)
        self.pot += self.players[(self.dealer_index + 2) % self.num_players].bet(self.BIGBLIND_BET)

        min_raise = self.bettingRound(self.dealer_index + 3, self.BIGBLIND_BET)

        first_bet_index = (self.dealer_index + 1) % self.num_players
        while self.players[first_bet_index].folded:
            first_bet_index = (first_bet_index + 1) % self.num_players

        flop = self.deck.deal(3)
        self.community_cards.extend(flop)
        min_raise = self.bettingRound(first_bet_index, min_raise)

        turn = self.deck.deal(1)
        self.community_cards.extend(turn)
        min_raise = self.bettingRound(first_bet_index, min_raise)

        river = self.deck.deal(1)
        self.community_cards.extend(river)
        self.bettingRound(first_bet_index, min_raise)

        self.getWinner(self.community_cards,self.players,self.pot)





    def bettingRound(self, starting_index, min_raise):
        i = starting_index % self.num_players
        cur_bet = self.current_bet
        players_acted = 0

        active_players = sum(1 for p in self.players if not p.folded)

        while active_players > 1 and players_acted < active_players:
            i = i % self.num_players
            player = self.players[i]

            if player.folded or player.all_in:
                i += 1
                continue

            call_amnt = cur_bet - player.current_bet

            player_state = {
                "hand": player.hand,
                "current_bet": player.current_bet,
                "player_stack": player.stack,
                "community_cards": self.community_cards,
                "call_amnt": call_amnt,
                "min_raise": min_raise,
                "players_left": active_players,
            }

            decision = player.decide(player_state)

            if decision == "Fold":
                player.fold()
                active_players -= 1
                players_acted += 1

            elif decision == "Check" or decision == "Call":
                self.pot += player.bet(call_amnt)
                players_acted += 1

            elif "Raise" in decision:
                amount = int(decision.split()[1])

                if amount < min_raise and player.stack < min_raise:
                    amount = player.stack
                elif amount < min_raise:
                    amount = min_raise

                total_bet = call_amnt + amount

                if player.stack == 0:
                    player.all_in = True

                self.pot += player.bet(total_bet)
                cur_bet = player.current_bet
                min_raise = amount
                players_acted = 1  # Reset, but raiser has already acted
                active_players = sum(1 for p in self.players if not p.folded)

            i += 1

        self.current_bet = cur_bet
        return min_raise

    def getWinner(self,community_cards,players,pot):
        win_index = []
        win_rank = 7463

        for i in range(len(players)):

            if players[i].folded:
                continue

            rank = evaluate_cards(
                str(players[i].hand[0]),
                str(players[i].hand[1]),
                *[str(card) for card in community_cards]
            )


            if rank > win_rank:
                continue

            elif rank < win_rank:
                win_rank = rank
                win_index = [i]

            elif rank == win_rank:
                win_index.append(i)

        for i in win_index:
            players[i].stack += pot / len(win_index)



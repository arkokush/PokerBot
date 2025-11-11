from cards import Deck

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

        for player in self.players:
            player.reset_for_new_round()
            player.hand = self.deck.deal(2)

        self.pot += self.players[(self.dealer_index + 1) % self.num_players].bet(self.BIGBLIND_BET//2)
        self.pot += self.players[(self.dealer_index + 2) % self.num_players].bet(self.BIGBLIND_BET)

        min_raise = self.BIGBLIND_BET

def bettingRound(self, starting_index, min_raise):
    i = starting_index % self.num_players
    cur_bet = self.current_bet
    players_folded = 0
    players_acted_since_raise = 0

    while True:
        players_left = self.num_players - players_folded

        if i == self.num_players:
            i = 0

        if players_left == 1:
            break

        if players_acted_since_raise >= players_left:
            break

        player = self.players[i]

        if player.folded or player.all_in:
            i += 1
            continue

        call_amnt = cur_bet - player.current_bet

        player_state = {
            "hand": player.hand,
            "current_bet": player.current_bet,
            "community_cards": self.community_cards,
            "call_amnt": call_amnt,
            "min_raise": min_raise,
            "players left": players_left,
        }

        decision = player.make_decision(player_state)

        if decision == "Fold":
            player.fold()
            players_folded += 1
            players_acted_since_raise += 1

        elif decision == "Check" or decision == "Call":
            self.pot += player.bet(call_amnt)
            players_acted_since_raise += 1

        elif "Raise" in decision:
            amount = int(decision.split()[1])
            total_bet = call_amnt + amount
            self.pot += player.bet(total_bet)
            cur_bet = player.current_bet
            min_raise = amount
            players_acted_since_raise = 1

        i += 1

    self.current_bet = cur_bet
    return min_raise


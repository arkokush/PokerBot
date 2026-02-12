class Agent:
    #player_state = {
    #    "hand": player.hand,
    #    "current_bet": player.current_bet,
    #    "player_stack": player.stack,
    #    "community_cards": self.community_cards,
    #    "call_amnt": call_amnt,
    #    "min_raise": min_raise,
    #    "players_left": active_players,
    #}

    def decide(self, state):
        """Returns {"action": str, "amount": optional int}"""
        raise NotImplementedError("Subclasses must implement decide()")

class RandomAgent(Agent):
    def decide(self, state):
        import random

        if state["call_amnt"] == 0:
            return "Check"

        legal_actions = ["Fold"]

        if state["call_amnt"] <= state["player_stack"]:
            legal_actions.append("Call")

        if state["min_raise"] < state["player_stack"]:
            raise_amount = random.randint(state["min_raise"], state["player_stack"] - state["min_raise"])
            legal_actions.append(f"Raise {raise_amount}")

        return random.choice(legal_actions)


class Player:
    def __init__(self, buy_in: int, agent: Agent, name: str = ""):
        self.stack = buy_in
        self.hand = []
        self.folded = False
        self.all_in = False
        self.current_bet = 0
        self.agent = agent
        self.name = name

    def getCards(self, cards):
        self.hand = cards

    def bet(self, amount: int):
        if amount > self.stack:
            raise ValueError(f"{self.name} cannot bet more than their stack.")
        self.stack -= amount
        self.current_bet += amount

        if self.stack == 0:
            self.all_in = True
        return amount

    def buy_in(self, amount: int):
        self.stack += amount
        return self.stack

    def fold(self):
        self.folded = True
        self.hand = []

    def reset_for_new_round(self):
        self.current_bet = 0
        self.folded = False
        self.all_in = False
        self.hand = []

    def decide(self, state):
        #player_state = {
        #    "hand": player.hand,
        #    "current_bet": player.current_bet,
        #    "player_stack": player.stack,
        #    "community_cards": self.community_cards,
        #    "call_amnt": call_amnt,
        #    "min_raise": min_raise,
        #    "players_left": active_players,
        #}

        return self.agent.decide(state)

    def __repr__(self):
        return f"{self.name} (stack={self.stack}, bet={self.current_bet}, folded={self.folded})"

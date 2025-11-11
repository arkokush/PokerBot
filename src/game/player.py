class Agent:
    class Agent:
        def decide(self, state, legal_actions):
            """Returns {"action": str, "amount": optional int}"""
            raise NotImplementedError("Subclasses must implement decide()")

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

    def buyIn(self, amount: int):
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

    def __repr__(self):
        return f"{self.name} (stack={self.stack}, bet={self.current_bet}, folded={self.folded})"

import random


class Agent:
    #NLHE player_state = {
    #    "hand": player.hand,
    #    "current_bet": player.current_bet,
    #    "player_stack": player.stack,
    #    "community_cards": self.community_cards,
    #    "call_amnt": call_amnt,
    #    "min_raise": min_raise,
    #    "players_left": active_players,
    #}

    def decide(self, state):
        """Returns an action string, e.g. "Fold", "Check", "Call", "Raise 20"."""
        raise NotImplementedError("Subclasses must implement decide()")


class RandomAgent(Agent):
    """
    Picks uniformly among LEGAL actions with LEGAL sizes:
      * facing no bet: Check, or a bet ("Raise") if chips remain;
      * facing a bet: Fold, Call (all-in for less when stack < call amount),
        or a raise when chips remain beyond the call;
      * raise sizes are drawn from [min_raise, stack - call_amnt]; when the
        stack cannot cover a full min-raise the only raise offered is the
        all-in short raise.
    """

    def decide(self, state):
        stack = state["player_stack"]
        call_amnt = state["call_amnt"]
        min_raise = state["min_raise"]

        if stack <= 0:
            # No chips: can only check (should not be asked to act otherwise).
            return "Check"

        if call_amnt == 0:
            legal_actions = ["Check"]
        else:
            # Calling is always legal: with stack < call_amnt it is an
            # all-in for less, which the game engine supports.
            legal_actions = ["Fold", "Call"]

        max_raise = stack - call_amnt
        if max_raise > 0:
            if max_raise >= min_raise:
                raise_amount = random.randint(min_raise, max_raise)
            else:
                raise_amount = max_raise  # all-in short raise
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
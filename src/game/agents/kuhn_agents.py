from game.player import Agent


class KuhnAgent(Agent):
    """
    Base class for Kuhn Poker agents.
    Override `decide` to implement strategy.
    """

    def decide(self, state):
        raise NotImplementedError("Subclasses must implement decide()")


class KuhnRandomAgent(KuhnAgent):
    """
    Simple random agent for Kuhn Poker.
    Returns a legal action string: "Check", "Bet", "Call", or "Fold".
    """

    def decide(self, state):
        import random

        # Kuhn Poker state provided by KuhnPokerGame:
        # (player_id, hand, stack, pot[, opponent_action])
        # - player_id: 1 or 2
        # - hand: [Card]
        # - stack: int
        # - pot: int
        # - opponent_action: "Check" or "Bet" when applicable
        
        if not isinstance(state, tuple) or len(state) < 4:
            return "Check"

        _, _, stack, _, *rest = state
        opponent_action = rest[0] if rest else None
        can_bet = stack >= 1

        if opponent_action == "Bet":
            legal_actions = ["Fold"] + (["Call"] if can_bet else [])
        else:
            legal_actions = ["Check"] + (["Bet"] if can_bet else [])

        return random.choice(legal_actions)

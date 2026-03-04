class PokerGameRules:
    """
    Abstract interface that all poker games must implement for CFR.
    CFR uses this interface to get game-specific information.
    """

    def deal_cards(self) -> tuple:
        """
        Deal cards for one hand.
        Returns: tuple of cards for all players
        """
        raise NotImplementedError

    def is_terminal(self, history: str) -> bool:
        """
        Check if game has ended.

        Args:
            history: Action sequence string
        Returns:
            True if game is over
        """
        raise NotImplementedError

    def get_payoff(self, player_cards: tuple, history: str, com_cards: tuple = None) -> float:
        """
        Get payoff for a terminal state.

        Args:
            player_cards: Dealt cards
            com_cards: Community Cards
            history: Action sequence
            player: Which player (0 or 1)
        Returns:
            Payoff for that player
        """
        raise NotImplementedError

    def get_info_set_string(self, player_cards: tuple, history: str, com_cards: tuple = None) -> str:
        """
        Create info set identifier.

        Args:
            card: Player's card(s)
            history: Action sequence
            com_cards: Community Cards
        Returns:
            Info set string
        """
        raise NotImplementedError

    def get_num_actions(self) -> int:
        """
        How many actions are available?
        Returns: Number of actions (2 for Kuhn)
        """
        raise NotImplementedError

    def get_legal_actions(self, history: str) -> list[str]:
        """
        Get legal actions at this point.

        Returns:
            List of action strings
        """
        raise NotImplementedError


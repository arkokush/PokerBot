# Game Variants Architecture

## Overview

The PokerBot project now supports multiple poker game variants through an extensible architecture. Similar to how different AI agents can be plugged into players, different poker games can now be easily created and used.

## Structure

```
game/
├── variants/
│   ├── base_game.py      # Abstract Game class (interface)
│   ├── nlholdem.py       # No Limit Texas Hold'em implementation
│   └── kuhn_poker.py     # Kuhn Poker implementation (to be completed)
├── table.py              # Exports all variants, backward compatibility
├── player.py             # Player and Agent classes
└── cards.py              # Card and Deck classes
```

## Design Pattern

The architecture follows the **Strategy Pattern**:

- **Base Class**: `Game` (abstract) - defines the interface
- **Concrete Implementations**: `NLHoldemGame`, `KuhnPokerGame`, etc.
- **Client Code**: Can switch between game types easily

This mirrors the agent architecture:
- `Agent` (abstract) → `RandomAgent`, `YourCustomAgent`, etc.
- `Game` (abstract) → `NLHoldemGame`, `KuhnPokerGame`, etc.

## Creating a New Game Variant

To add a new poker variant:

1. **Create a new file** in `game/variants/` (e.g., `omaha.py`)

2. **Inherit from Game**:
```python
from .base_game import Game

class OmahaGame(Game):
    def __init__(self, players, big_blind):
        super().__init__(players)
        # Add game-specific attributes
        
    def startRound(self):
        # Implement game flow
        pass
        
    def bettingRound(self, *args, **kwargs):
        # Implement betting logic
        pass
        
    def getWinner(self, *args, **kwargs):
        # Implement winner determination
        pass
```

3. **Export from variants**:
Add to `game/variants/__init__.py`:
```python
from .omaha import OmahaGame
__all__ = [..., 'OmahaGame']
```

4. **Export from table.py**:
Add to `game/table.py`:
```python
from variants.omaha import OmahaGame
__all__ = [..., 'OmahaGame']
```

## Usage Examples

### Direct Instantiation
```python
from game.table import NLHoldemGame, KuhnPokerGame
from game.player import Player, RandomAgent

players = [Player(1000, RandomAgent(), f"P{i}") for i in range(3)]

# Choose your game variant
game = NLHoldemGame(players, big_blind=10)
# OR
game = KuhnPokerGame(players[:2])  # Kuhn needs exactly 2 players

game.startRound()
```

### Backward Compatibility
```python
from game.table import Game

# This still works - defaults to NLHoldemGame
game = Game(players, BIGBLIND_BET=10)
```

### Dynamic Game Selection
```python
def create_game(game_type, players, **kwargs):
    games = {
        'nlholdem': NLHoldemGame,
        'kuhn': KuhnPokerGame,
    }
    return games[game_type](players, **kwargs)

# Use it
game = create_game('nlholdem', players, big_blind=20)
```

## Implementing Kuhn Poker

Kuhn Poker is a simplified poker game perfect for AI research:

### Rules
- **Players**: Exactly 2
- **Deck**: 3 cards (K, Q, J)
- **Antes**: 1 chip each
- **Cards dealt**: 1 card per player
- **Betting**: Single round
  - First player: check or bet 1
  - If checked: second player can check (showdown) or bet 1
  - If bet: second player can fold or call
- **Showdown**: Highest card wins (K > Q > J)

### Implementation Checklist

When implementing `kuhn_poker.py`, you'll need to:

- [ ] Create a 3-card deck (K, Q, J)
- [ ] Validate exactly 2 players
- [ ] Deal 1 card to each player
- [ ] Post antes (1 chip each)
- [ ] Implement simplified betting round:
  - Track who has acted
  - Handle check/bet/fold/call actions
  - No raises (only 1 bet allowed)
- [ ] Determine winner:
  - If someone folded, other wins
  - Otherwise, compare card ranks

### Kuhn Poker State

The `state` dict for Kuhn Poker might look like:
```python
state = {
    "hand": [Card("K")],  # Single card
    "current_bet": 0 or 1,
    "player_stack": remaining_chips,
    "pot": current_pot,
    "opponent_bet": 0 or 1,
    "legal_actions": ["Check", "Bet"] or ["Fold", "Call"]
}

## NL Hold'em Notes

- Uses `phevaluator` for 7-card hand evaluation at showdown.
- Bets reset each street (pre-flop → flop → turn → river) with the minimum raise reset to the big blind.
```

## Benefits of This Architecture

1. **Separation of Concerns**: Each game variant is self-contained
2. **Easy Testing**: Test each variant independently
3. **Extensibility**: Add new games without modifying existing code
4. **Polymorphism**: All games share the same interface
5. **Backward Compatibility**: Existing code continues to work

## Next Steps

1. **Complete Kuhn Poker implementation** - great for learning and testing AI agents
2. **Add more variants**: Omaha, Five Card Draw, etc.
3. **Create variant-specific agents**: Some strategies work better for certain games
4. **Tournament mode**: Play different variants in sequence

---

**Remember**: Just like you can swap `RandomAgent` for your custom agent, you can now swap `NLHoldemGame` for any other poker variant!

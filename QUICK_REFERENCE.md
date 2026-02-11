# Quick Reference: Game Variants

## At a Glance

| Game Variant | Players | Deck | Hand Size | Betting Rounds | Status |
|--------------|---------|------|-----------|----------------|--------|
| **No Limit Texas Hold'em** | 2-10 | 52 cards | 2 hole + 5 community | 4 (pre-flop, flop, turn, river) | Complete |
| **Kuhn Poker** | 2 | 3 cards (K,Q,J) | 1 hole | 1 | 🚧 Structure only |

## How to Use

### Import Options

```python
# Option 1: Import specific variant
from game.table import NLHoldemGame

# Option 2: Import all variants
from game.table import NLHoldemGame, KuhnPokerGame

# Option 3: Backward compatible (defaults to NLHoldemGame)
from game.table import Game
```

### Creating Games

```python
from game.player import Player, RandomAgent
from game.table import NLHoldemGame, KuhnPokerGame

players = [
    Player(buy_in=1000, agent=RandomAgent(), name="Alice"),
    Player(buy_in=1000, agent=RandomAgent(), name="Bob"),
]

# No Limit Texas Hold'em
nlh = NLHoldemGame(players, big_blind=10)
nlh.startRound()

# Kuhn Poker (when implemented)
kuhn = KuhnPokerGame(players)
kuhn.startRound()
```

## File Locations

- **Base class**: `src/game/variants/base_game.py`
- **NLH implementation**: `src/game/variants/nlholdem.py`
- **Kuhn implementation**: `src/game/variants/kuhn_poker.py`
- **Main exports**: `src/game/table.py`
- **Examples**: `src/examples/game_variants_example.py`

## What Changed?

### Before
```
game/
├── table.py  # Contains Game class with NLH logic
```

### After
```
game/
├── table.py          # Imports and exports all variants
└── variants/
    ├── base_game.py  # Abstract Game class
    ├── nlholdem.py   # NLH implementation
    └── kuhn_poker.py # Kuhn implementation
```

### Migration

Your existing code **still works**!

```python
# Old code - still works
from game.table import Game
game = Game(players, BIGBLIND_BET=10)

# New code - more explicit
from game.table import NLHoldemGame
game = NLHoldemGame(players, big_blind=10)
```

## Adding New Variants

1. Create `src/game/variants/your_game.py`
2. Inherit from `Game` base class
3. Implement `startRound()`, `bettingRound()`, `getWinner()`
4. Export from `variants/__init__.py` and `table.py`

See `GAME_VARIANTS.md` for detailed instructions.

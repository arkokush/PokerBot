# PokerBot

**⚠️ This project is in early development** 

A Python-based Texas Hold'em poker bot that will be able to play poker autonomously against other players. The goal is to create a fully functional poker agent using rule-based decision-making strategies.

## Project Overview

PokerBot is being built in two phases:
1. **Phase 1 (Current)**: Building the game engine - implementing complete Texas Hold'em game logic, betting rounds, and player management
2. **Phase 2 (Next)**: Bot intelligence - developing rule-based AI agents that can make strategic poker decisions

The architecture separates game logic, player behavior, and card management into distinct modules, making it easy to implement and test different poker strategies once the core engine is complete.

## Features

### Currently Implemented (Phase 1 - Game Engine)
- ✅ Deck management with shuffling and dealing
- ✅ Player state management (stack, bets, folding, all-in)
- ✅ Betting round logic with proper raise rules
- ✅ Blind posting system
- ✅ Full game flow (No Limit Texas Hold'em)
- ✅ Hand evaluation using phevaluator
- ✅ Extensible game variant architecture
- ✅ RandomAgent implementation
- 🚧 Kuhn Poker variant (structure created, to be implemented)

### Planned (Phase 2 - Bot Intelligence)
- 🎯 Rule-based decision-making system
- 🎯 Hand strength evaluation
- 🎯 Position-aware strategy
- 🎯 Opponent modeling
- 🎯 Pot odds calculation

## Requirements

### Python Version
- **Python 3.9+** (recommended: Python 3.9 or 3.10)

### Dependencies
This project uses only Python standard library:
- `random` - for deck shuffling
- No external dependencies required!

## Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd PokerBot
   ```

2. **Set up a virtual environment** (recommended)
   ```bash
   python3.9 -m venv .venv
   source .venv/bin/activate  # On macOS/Linux
   # .venv\Scripts\activate  # On Windows
   ```

3. **Verify Python version**
   ```bash
   python --version  # Should show Python 3.9 or higher
   ```

## Project Structure

```
PokerBot/
├── README.md                 # This file
├── .gitignore               # Git ignore rules
├── PokerBot.iml            # IntelliJ project file
├── .venv/                  # Virtual environment (not in repo)
├── .idea/                  # IDE settings (not in repo)
└── src/
    └── game/
        ├── __init__.py     # Package initializer
        ├── cards.py        # Card and Deck classes
        ├── player.py       # Player and Agent classes
        └── table.py        # Game logic and betting rounds
```

## Module Documentation

### `cards.py`
Handles card and deck management.

**Classes:**
- `Card`: Represents a single playing card with suit and value
- `Deck`: Manages a 52-card deck with shuffle and deal methods

**Example Usage:**
```python
from game.cards import Deck

deck = Deck()
deck.shuffle()
hand = deck.deal(2)  # Deal 2 cards
```

### `player.py`
Defines player behavior and AI agent interface.

**Classes:**
- `Agent`: Abstract base class for AI decision-making
  - Subclass this to create your own poker bots
  - Implement `decide(state, legal_actions)` method
- `Player`: Represents a player with stack, hand, and betting logic

**Creating a Custom Bot:**
```python
from game.player import Agent, Player

class MyBot(Agent):
    def decide(self, state, legal_actions):
        # Your strategy here
        return {"action": "Call", "amount": 0}

player = Player(buy_in=1000, agent=MyBot(), name="Bot1")
```

### `table.py`
Manages game flow and betting rounds.

**Classes:**
- `Game`: Main game controller
  - Handles dealer rotation
  - Manages community cards and pot
  - Controls betting rounds

**Key Methods:**
- `startRound()`: Initializes a new hand with blinds
- `bettingRound(starting_index, min_raise)`: Executes one betting round

## Poker Rules Implementation

This implementation follows **No-Limit Texas Hold'em** rules:

### Betting Rules
1. **Minimum Raise**: Initially equal to the big blind
2. **Subsequent Raises**: Must match or exceed the previous raise amount
3. **All-In**: Players can bet their entire stack at any time
4. **Street Resets**: Minimum raise resets to big blind on flop, turn, river

### Game Flow
1. Dealer button rotates clockwise
2. Small blind and big blind posted
3. Two hole cards dealt to each player
4. Pre-flop betting round
5. Three community cards (flop) + betting round
6. Fourth community card (turn) + betting round
7. Fifth community card (river) + betting round
8. Showdown (if multiple players remain)

## Usage Example

> **Note**: The game engine is still under development. Below is the intended usage once Phase 1 is complete.

```python
from game.cards import Deck
from game.player import Agent, Player
from game.table import Game

# Create custom agent (Phase 2 - not yet implemented)
class SimpleBot(Agent):
    def decide(self, state, legal_actions):
        # Placeholder - bot logic will be developed in Phase 2
        if state["call_amnt"] == 0:
            return {"action": "Check"}
        return {"action": "Call"}

# Set up players
players = [
    Player(buy_in=1000, agent=SimpleBot(), name="Bot1"),
    Player(buy_in=1000, agent=SimpleBot(), name="Bot2"),
    Player(buy_in=1000, agent=SimpleBot(), name="Bot3"),
]

# Create game
game = Game(players=players, BIGBLIND_BET=20)

# Start a round
game.startRound()

# Run betting rounds (currently implementing)
min_raise = game.BIGBLIND_BET
min_raise = game.bettingRound(starting_index=game.dealer_index + 3, min_raise=min_raise)
```

## Development Status

### Phase 1: Game Engine (Current Focus) 🔨
**Goal**: Complete, working Texas Hold'em game that can be played with placeholder agents

- [x] Card and deck system
- [x] Player state management
- [x] Betting round framework with proper raise logic
- [x] Blind posting
- [ ] **In Progress**: Full game loop (pre-flop → flop → turn → river → showdown)
- [ ] **In Progress**: Hand evaluation and winner determination
- [ ] Complete round management and pot distribution
- [ ] Edge case handling (side pots, all-ins, etc.)

### Phase 2: Bot Intelligence (Next) 🤖
**Goal**: Create autonomous poker agents that make intelligent decisions

- [ ] Implement hand strength calculator
- [ ] Build rule-based decision tree
- [ ] Add position-based strategy
- [ ] Implement pot odds logic
- [ ] Create multiple bot personalities/strategies
- [ ] Test bots against each other

### Future Enhancements 🚀
- [ ] Statistics tracking and analysis
- [ ] Multi-round tournament mode
- [ ] Game logging and replay
- [ ] Visualization/GUI
- [ ] Performance optimization

## Contributing

Feel free to fork this project and implement your own poker strategies! The agent-based architecture makes it easy to test different approaches.

## Known Issues

- Hand evaluation not yet implemented
- Need to handle edge cases for all-in side pots
- Player decision interface needs standardization (currently uses string parsing)

## License

[Add your license here]

## Author

Arkady Kokush

---

**Note**: This is a simulation/learning project. Not intended for real-money gambling.


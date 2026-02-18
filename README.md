# PokerBot

**⚠️ This project is in early development** 

A Python-based Texas Hold'em poker bot that will be able to play poker autonomously against other players. The goal is to create a fully functional poker agent using rule-based decision-making strategies.

## Project Overview

PokerBot is being built in two phases:
1. **Phase 1 (Current)**: Building the game engine - implementing complete Texas Hold'em game logic, betting rounds, and player management
2. **Phase 2 (Next)**: Bot intelligence - developing rule-based AI agents that can make strategic poker decisions

The architecture separates game logic, player behavior, and card management into distinct modules, making it easy to implement and test different poker strategies once the core engine is complete.

## Features

### Currently Implemented ✅
- ✅ **No Limit Texas Hold'em** - Complete game implementation
- ✅ **Kuhn Poker** - Simplified poker variant for CFR training
- ✅ Deck management with shuffling and dealing
- ✅ Player state management (stack, bets, folding, all-in)
- ✅ Betting round logic with proper raise rules
- ✅ Blind posting system
- ✅ Hand evaluation using phevaluator
- ✅ Extensible game variant architecture
- ✅ RandomAgent implementation
- ✅ Modular project structure for CFR training

### In Development 🚧
- 🚧 **CFR Algorithm** - For training optimal poker strategies
- 🚧 **Leduc Poker** - Additional training variant
- 🚧 **Strategy Evaluation** - Tools for testing trained agents

### Planned (Phase 2 - Bot Intelligence) 🎯
- 🎯 Advanced rule-based decision-making
- 🎯 Hand strength evaluation
- 🎯 Position-aware strategy
- 🎯 Opponent modeling
- 🎯 Pot odds calculation
- 🎯 Monte Carlo CFR implementation

## Requirements

### Python Version
- **Python 3.9+** (recommended: Python 3.9 or 3.10)

### Dependencies
- `phevaluator` - for hand evaluation in Texas Hold'em
- `random` (standard library) - for deck shuffling

Install dependencies:
```bash
pip install phevaluator
```

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
├── LICENSE                   # MIT License
├── PROJECT_STRUCTURE.md      # Detailed structure documentation
├── GAME_VARIANTS.md          # Game variant descriptions
├── QUICK_REFERENCE.md        # Quick reference guide
├── .gitignore               # Git ignore rules
├── PokerBot.iml            # IntelliJ project file
├── .venv/                  # Virtual environment (not in repo)
├── .idea/                  # IDE settings (not in repo)
└── src/
    ├── __init__.py          # Main package init
    │
    ├── games/               # Game implementations
    │   ├── __init__.py
    │   ├── base.py          # Abstract PokerGame interface
    │   ├── kuhn_poker.py    # Kuhn Poker (3-card variant)
    │   ├── leduc_poker.py   # Leduc Poker (placeholder)
    │   ├── limit_holdem.py  # Limit Hold'em (placeholder)
    │   └── nl_holdem.py     # No Limit Hold'em (fully implemented)
    │
    ├── algorithms/          # CFR training algorithms
    │   ├── __init__.py
    │   ├── cfr.py           # Generic CFR class
    │   ├── mccfr.py         # Monte Carlo CFR (placeholder)
    │   ├── info_set.py      # Information Set class
    │   └── cfr_plus.py      # CFR+ variant (placeholder)
    │
    ├── evaluation/          # Strategy evaluation tools
    │   ├── __init__.py
    │   ├── evaluator.py     # Head-to-head play evaluation
    │   └── exploitability.py # Exploitability calculations
    │
    ├── utils/               # Shared utilities
    │   ├── __init__.py
    │   ├── cards.py         # Card and Deck classes
    │   └── player.py        # Player and Agent classes
    │
    └── examples/            # Training examples
        ├── train_kuhn.py    # Kuhn Poker CFR training
        └── train_leduc.py   # Leduc Poker CFR training
```

## Module Organization

### `games/`
Contains all poker game variant implementations. Each game inherits from the abstract `PokerGame` class and implements:
- `startRound()`: Initialize and run a complete round
- `bettingRound()`: Handle betting logic
- `getWinner()`: Determine winner and distribute pot

### `algorithms/`
CFR (Counterfactual Regret Minimization) implementations for training optimal poker strategies.

### `evaluation/`
Tools for evaluating trained strategies through head-to-head play and exploitability analysis.

### `utils/`
Shared utilities for cards, decks, players, and agents.

### `examples/`
Runnable examples showing how to train CFR on different game variants.

---

## Module Documentation

### `games/`
Contains poker game variant implementations. All games inherit from the abstract `PokerGame` class.

**Available Games:**
- **NLHoldem**: No Limit Texas Hold'em (fully implemented)
- **KuhnPoker**: Simplified 3-card poker for CFR training
- **LeducPoker**: 6-card poker variant (placeholder)
- **LimitHoldem**: Limit betting variant (placeholder)

**Example Usage:**
```python
from src.games import NLHoldem, KuhnPoker
from src.utils import Player, RandomAgent

# Create players
players = [
    Player(buy_in=1000, agent=RandomAgent(), name="Player1"),
    Player(buy_in=1000, agent=RandomAgent(), name="Player2")
]

# Create and start a game
game = NLHoldem(players=players, big_blind=20)
game.startRound()
```

### `utils/cards.py`
Handles card and deck management.

**Classes:**
- `Card`: Represents a single playing card
- `Deck`: Manages a 52-card deck with shuffle and deal methods

**Example Usage:**
```python
from src.utils import Card, Deck

# Create cards
card = Card("Ah")  # Ace of hearts
print(card.getRank())  # "A"
print(card.getSuit())  # "h"

# Use deck
deck = Deck()
deck.shuffle()
hand = deck.deal(2)  # Deal 2 cards
```

### `utils/player.py`
Defines player behavior and AI agent interface.

**Classes:**
- `Agent`: Abstract base class for AI decision-making
  - Subclass this to create your own poker bots
  - Implement `decide(state)` method
- `RandomAgent`: Simple agent that makes random legal decisions
- `Player`: Represents a player with stack, hand, and betting logic

**Creating a Custom Bot:**
```python
from src.utils import Agent, Player

class MyBot(Agent):
    def decide(self, state):
        # Your strategy here
        if state["call_amnt"] == 0:
            return "Check"
        return "Call"

player = Player(buy_in=1000, agent=MyBot(), name="Bot1")
```

### `algorithms/`
CFR (Counterfactual Regret Minimization) implementations for training optimal strategies.

**Planned Components:**
- `CFR`: Generic CFR algorithm
- `MCCFR`: Monte Carlo CFR for larger games
- `CFRPlus`: Faster converging CFR variant
- `InformationSet`: Stores strategy and regret data

### `evaluation/`
Tools for evaluating trained strategies.

**Planned Components:**
- `Evaluator`: Head-to-head match simulation
- `exploitability`: Calculate how exploitable a strategy is

---

## Game Variants

### No Limit Texas Hold'em
- **Players**: 2-10
- **Deck**: Standard 52 cards
- **Hand Size**: 2 hole cards + 5 community cards
- **Betting Rounds**: 4 (pre-flop, flop, turn, river)
- **Status**: ✅ Fully implemented

### Kuhn Poker
- **Players**: 2
- **Deck**: 3 cards (K, Q, J)
- **Hand Size**: 1 hole card
- **Betting Rounds**: 1
- **Status**: ✅ Fully implemented

### Leduc Poker
- **Players**: 2
- **Deck**: 6 cards (2 Jacks, 2 Queens, 2 Kings)
- **Hand Size**: 1 hole card + 1 community card
- **Betting Rounds**: 2
- **Status**: 🚧 Placeholder (to be implemented)

### Limit Hold'em
- **Players**: 2-10
- **Deck**: Standard 52 cards
- **Hand Size**: 2 hole cards + 5 community cards
- **Betting Rounds**: 4 (pre-flop, flop, turn, river)
- **Status**: 🚧 Placeholder (to be implemented)

---

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

```python
from src.games import NLHoldem, KuhnPoker
from src.utils import Agent, Player, RandomAgent

# Create custom agent
class SimpleBot(Agent):
    def decide(self, state):
        # Simple strategy: check/call only
        if state.get("call_amnt", 0) == 0:
            return "Check"
        return "Call"

# Set up players
players = [
    Player(buy_in=1000, agent=SimpleBot(), name="Bot1"),
    Player(buy_in=1000, agent=RandomAgent(), name="Bot2"),
    Player(buy_in=1000, agent=RandomAgent(), name="Bot3"),
]

# Create and run a No Limit Hold'em game
game = NLHoldem(players=players, big_blind=20)
game.startRound()

print(f"Winner's stacks: {[p.stack for p in players]}")

# Or try Kuhn Poker (simpler variant)
kuhn_players = [
    Player(buy_in=100, agent=RandomAgent(), name="P1"),
    Player(buy_in=100, agent=RandomAgent(), name="P2"),
]
kuhn_game = KuhnPoker(players=kuhn_players)
kuhn_game.startRound()
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

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Author

Arkady Kokush

---

**Note**: This is a simulation/learning project. Not intended for real-money gambling.


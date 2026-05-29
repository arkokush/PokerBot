import type { Card, Rank, Suit, GameConfig, GameEngine, GameState, Player, PlayerAction, Action, Street } from './types'
import { mulberry32 } from './rng'
import { encodeCards, eval7 } from './hand_eval'

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const result = [...arr]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

const RANKS: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A']
const SUITS: Suit[] = ['h', 'd', 'c', 's']

function buildDeck(): Card[] {
  const deck: Card[] = []
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ rank, suit })
    }
  }
  return deck
}

// ---------- Engine state ----------

interface HoldemExtra {
  deck: Card[]
  betsThisRound: number
}

const extraState = new Map<number, HoldemExtra>()
let globalRng: () => number = Math.random

const STREET_ORDER: Street[] = ['preflop', 'flop', 'turn', 'river']

function nextStreet(s: Street): Street | null {
  const idx = STREET_ORDER.indexOf(s)
  return idx < STREET_ORDER.length - 1 ? STREET_ORDER[idx + 1] : null
}

function betSizeForStreet(street: Street, bigBlind: number): number {
  if (street === 'preflop' || street === 'flop') return bigBlind
  return bigBlind * 2
}

export const limitHoldemEngine: GameEngine = {
  createInitialState(config: GameConfig, players: Pick<Player, 'id' | 'name' | 'isBot' | 'botStrategy'>[]): GameState {
    if (config.seed !== undefined) {
      globalRng = mulberry32(config.seed)
    } else {
      globalRng = mulberry32(Date.now())
    }

    const gamePlayers: Player[] = players.map(p => ({
      ...p,
      stack: config.startingStack,
      holeCards: [],
      folded: false,
      currentBet: 0,
    }))

    return {
      variant: 'limit_holdem',
      players: gamePlayers,
      communityCards: [],
      pot: 0,
      currentPlayerIndex: 0,
      street: 'preflop',
      dealerIndex: 0,
      isHandOver: false,
      winner: null,
      winAmount: 0,
      handNumber: 0,
      actionHistory: [],
      validActions: [],
      betToCall: 0,
      currentBetSize: config.bigBlind,
      smallBlind: config.smallBlind,
      bigBlind: config.bigBlind,
    }
  },

  dealNewHand(state: GameState): GameState {
    const deck = shuffle(buildDeck(), globalRng)
    const { smallBlind, bigBlind } = state
    const extra: HoldemExtra = {
      deck,
      betsThisRound: 0,
    }

    const handNumber = state.handNumber + 1
    extraState.set(handNumber, extra)

    // For heads-up: dealer/SB rotates each hand
    const dealerIdx = 1 - state.dealerIndex
    const sbIdx = dealerIdx
    const bbIdx = 1 - dealerIdx

    const players = state.players.map((p, i) => {
      const newP = { ...p, holeCards: [deck[i * 2], deck[i * 2 + 1]], folded: false, currentBet: 0 }
      if (i === sbIdx) {
        newP.currentBet = smallBlind
        newP.stack = p.stack - smallBlind
      } else if (i === bbIdx) {
        newP.currentBet = bigBlind
        newP.stack = p.stack - bigBlind
      }
      return newP
    })

    extra.betsThisRound = 1 // BB counts as first bet

    const newState: GameState = {
      ...state,
      players,
      communityCards: [],
      pot: smallBlind + bigBlind,
      currentPlayerIndex: sbIdx, // SB acts first preflop in heads-up
      street: 'preflop',
      isHandOver: false,
      winner: null,
      winAmount: 0,
      handNumber,
      actionHistory: [],
      betToCall: bigBlind - smallBlind,
      currentBetSize: bigBlind,
      dealerIndex: dealerIdx,
      validActions: getActionsForState(bigBlind - smallBlind, 1),
    }

    return newState
  },

  applyAction(state: GameState, action: PlayerAction): GameState {
    const extra = extraState.get(state.handNumber)!
    const newState: GameState = {
      ...state,
      players: state.players.map(p => ({ ...p, holeCards: [...p.holeCards] })),
      communityCards: [...state.communityCards],
      actionHistory: [...state.actionHistory, { playerIndex: state.currentPlayerIndex, action, street: state.street }],
    }

    const currentPlayer = newState.players[newState.currentPlayerIndex]
    const opponent = newState.players[1 - newState.currentPlayerIndex]

    if (action.type === 'fold') {
      currentPlayer.folded = true
      newState.isHandOver = true
      newState.winner = opponent.id
      newState.winAmount = newState.pot
      opponent.stack += newState.pot
      newState.pot = 0
      newState.validActions = []
      return newState
    }

    if (action.type === 'check') {
      // Check if this completes the round
      const roundActions = newState.actionHistory.filter(a => a.street === newState.street)
      // Preflop: BB checks after SB calls (special case)
      // Postflop: second check ends the round
      if (newState.street === 'preflop') {
        // BB checking after SB limped in
        if (roundActions.length >= 2) {
          return advanceStreet(newState, extra)
        }
      } else {
        if (roundActions.length >= 2) {
          return advanceStreet(newState, extra)
        }
      }
      newState.currentPlayerIndex = 1 - newState.currentPlayerIndex
      newState.validActions = getActionsForState(0, extra.betsThisRound)
      return newState
    }

    if (action.type === 'call') {
      const callAmount = newState.betToCall
      currentPlayer.stack -= callAmount
      currentPlayer.currentBet += callAmount
      newState.pot += callAmount
      newState.betToCall = 0

      // Calling ends the betting round (unless it's the preflop SB completing)
      // After a call, check if we should give BB option
      if (newState.street === 'preflop' && extra.betsThisRound === 1) {
        // SB just called (limped), BB gets option to check or raise
        newState.currentPlayerIndex = 1 - newState.currentPlayerIndex
        newState.betToCall = 0
        newState.validActions = getActionsForState(0, extra.betsThisRound)
        return newState
      }

      return advanceStreet(newState, extra)
    }

    if (action.type === 'bet') {
      const betAmt = betSizeForStreet(newState.street, newState.bigBlind)
      currentPlayer.stack -= betAmt
      currentPlayer.currentBet += betAmt
      newState.pot += betAmt
      newState.betToCall = betAmt
      extra.betsThisRound = 1
      newState.currentPlayerIndex = 1 - newState.currentPlayerIndex
      newState.validActions = getActionsForState(betAmt, extra.betsThisRound)
      return newState
    }

    if (action.type === 'raise') {
      const raiseSize = betSizeForStreet(newState.street, newState.bigBlind)
      const totalCost = newState.betToCall + raiseSize
      currentPlayer.stack -= totalCost
      currentPlayer.currentBet += totalCost
      newState.pot += totalCost
      newState.betToCall = raiseSize
      extra.betsThisRound++
      newState.currentPlayerIndex = 1 - newState.currentPlayerIndex
      newState.validActions = getActionsForState(raiseSize, extra.betsThisRound)
      return newState
    }

    return newState
  },

  getValidActions(state: GameState): { actions: Action[]; betSize: number; callAmount: number } {
    const extra = extraState.get(state.handNumber)
    const betSize = extra ? betSizeForStreet(state.street, state.bigBlind) : state.currentBetSize
    return {
      actions: state.validActions,
      betSize,
      callAmount: state.betToCall,
    }
  },
}

function getActionsForState(betToCall: number, betsThisRound: number): Action[] {
  if (betToCall === 0) {
    // No bet to call: can check or bet
    return ['check', 'bet']
  }
  // Facing a bet/raise
  const actions: Action[] = ['fold', 'call']
  if (betsThisRound < 4) {
    actions.push('raise')
  }
  return actions
}

function advanceStreet(state: GameState, extra: HoldemExtra): GameState {
  // Reset bets
  state.players.forEach(p => { p.currentBet = 0 })
  extra.betsThisRound = 0
  state.betToCall = 0

  const next = nextStreet(state.street)
  if (next === null) {
    return resolveShowdown(state)
  }

  state.street = next
  state.currentBetSize = betSizeForStreet(next, state.bigBlind)

  // Deal community cards
  const deckStart = 4 // first 4 cards are hole cards
  if (next === 'flop') {
    state.communityCards = [extra.deck[deckStart], extra.deck[deckStart + 1], extra.deck[deckStart + 2]]
  } else if (next === 'turn') {
    state.communityCards = [...state.communityCards, extra.deck[deckStart + 3]]
  } else if (next === 'river') {
    state.communityCards = [...state.communityCards, extra.deck[deckStart + 4]]
  }

  // Post-flop: non-dealer acts first (BB = index 1 - dealerIndex)
  state.currentPlayerIndex = 1 - state.dealerIndex
  state.validActions = ['check', 'bet']
  return state
}

function resolveShowdown(state: GameState): GameState {
  const p0 = state.players[0]
  const p1 = state.players[1]

  state.isHandOver = true
  state.validActions = []

  if (p0.folded) {
    state.winner = p1.id
    state.winAmount = state.pot
    p1.stack += state.pot
    state.pot = 0
    return state
  }
  if (p1.folded) {
    state.winner = p0.id
    state.winAmount = state.pot
    p0.stack += state.pot
    state.pot = 0
    return state
  }

  const v0 = eval7(encodeCards([...p0.holeCards, ...state.communityCards]))
  const v1 = eval7(encodeCards([...p1.holeCards, ...state.communityCards]))
  // Lower value = stronger hand.
  if (v0 < v1) {
    state.winner = p0.id
    state.winAmount = state.pot
    p0.stack += state.pot
  } else if (v1 < v0) {
    state.winner = p1.id
    state.winAmount = state.pot
    p1.stack += state.pot
  } else {
    state.winner = null
    state.winAmount = state.pot
    const half = state.pot / 2
    p0.stack += half
    p1.stack += half
  }
  state.pot = 0
  return state
}

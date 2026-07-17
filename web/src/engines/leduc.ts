import type { Card, GameConfig, GameEngine, GameState, LeducHandState, Player, PlayerAction, Action } from './types'
import { mulberry32, shuffle } from './rng'

const LEDUC_DECK: Card[] = [
  { rank: 'J', suit: 'h' },
  { rank: 'J', suit: 's' },
  { rank: 'Q', suit: 'h' },
  { rank: 'Q', suit: 's' },
  { rank: 'K', suit: 'h' },
  { rank: 'K', suit: 's' },
]

const RANK_VALUE: Record<string, number> = { J: 0, Q: 1, K: 2 }

// Maximum bets per round: one bet plus two raises, matching the Python
// trainer / leduc_strategy.json (info sets like "...PBRR" exist in the model).
const MAX_BETS_PER_ROUND = 3

let globalRng: () => number = Math.random

export const leducEngine: GameEngine = {
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
      variant: 'leduc',
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
      currentBetSize: 2,
      smallBlind: 1,
      bigBlind: 2,
    }
  },

  dealNewHand(state: GameState): GameState {
    const deck = shuffle(LEDUC_DECK, globalRng)
    const players = state.players.map((p, i) => ({
      ...p,
      holeCards: [deck[i]],
      folded: false,
      currentBet: 1, // ante
      stack: p.stack - 1,
    }))

    // The "player 0" role (first to act in both rounds) alternates between seats.
    const dealerIdx = 1 - state.dealerIndex

    const newState: GameState = {
      ...state,
      players,
      communityCards: [],
      pot: 2,
      currentPlayerIndex: dealerIdx, // first actor alternates each hand
      street: 'preflop', // round 1 (before community card)
      isHandOver: false,
      winner: null,
      winAmount: 0,
      handNumber: state.handNumber + 1,
      actionHistory: [],
      betToCall: 0,
      currentBetSize: 2,
      validActions: ['check', 'bet'],
      dealerIndex: dealerIdx,
      handState: {
        kind: 'leduc',
        deck, // community card will be deck[2]
        raisesThisRound: 0,
      },
    }

    return newState
  },

  applyAction(state: GameState, action: PlayerAction): GameState {
    if (!state.validActions.includes(action.type)) {
      throw new Error(
        `leduc.applyAction: illegal action '${action.type}' for player ${state.currentPlayerIndex}` +
        ` (valid: [${state.validActions.join(', ')}], street: ${state.street}, handOver: ${state.isHandOver})`,
      )
    }

    const prevExtra = state.handState as LeducHandState
    const newState: GameState = {
      ...state,
      players: state.players.map(p => ({ ...p, holeCards: [...p.holeCards] })),
      communityCards: [...state.communityCards],
      actionHistory: [...state.actionHistory, { playerIndex: state.currentPlayerIndex, action, street: state.street }],
      handState: { ...prevExtra },
    }

    const extra = newState.handState as LeducHandState
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
      const roundActions = newState.actionHistory.filter(a => a.street === newState.street)
      // Both players checked
      if (roundActions.length >= 2 && roundActions[roundActions.length - 1].action.type === 'check' && roundActions[roundActions.length - 2].action.type === 'check') {
        return advanceStreet(newState, extra)
      }
      // First check, move to opponent
      newState.currentPlayerIndex = 1 - newState.currentPlayerIndex
      newState.validActions = ['check', 'bet']
      return newState
    }

    if (action.type === 'bet') {
      const betSize = newState.currentBetSize
      currentPlayer.stack -= betSize
      currentPlayer.currentBet += betSize
      newState.pot += betSize
      newState.betToCall = betSize
      extra.raisesThisRound = 1
      newState.currentPlayerIndex = 1 - newState.currentPlayerIndex

      // After a bet, opponent can fold, call, or raise (bet + up to 2 raises per round)
      const actions: Action[] = ['fold', 'call']
      if (extra.raisesThisRound < MAX_BETS_PER_ROUND) {
        actions.push('raise')
      }
      newState.validActions = actions
      return newState
    }

    if (action.type === 'raise') {
      const raiseSize = newState.currentBetSize
      const totalToCall = newState.betToCall
      const totalCost = totalToCall + raiseSize
      currentPlayer.stack -= totalCost
      currentPlayer.currentBet += totalCost
      newState.pot += totalCost
      newState.betToCall = raiseSize
      extra.raisesThisRound++
      newState.currentPlayerIndex = 1 - newState.currentPlayerIndex

      const actions: Action[] = ['fold', 'call']
      if (extra.raisesThisRound < MAX_BETS_PER_ROUND) {
        actions.push('raise')
      }
      newState.validActions = actions
      return newState
    }

    if (action.type === 'call') {
      const callAmount = newState.betToCall
      currentPlayer.stack -= callAmount
      currentPlayer.currentBet += callAmount
      newState.pot += callAmount
      newState.betToCall = 0
      return advanceStreet(newState, extra)
    }

    return newState
  },

  getValidActions(state: GameState): { actions: Action[]; betSize: number; callAmount: number } {
    return {
      actions: state.validActions,
      betSize: state.currentBetSize,
      callAmount: state.betToCall,
    }
  },
}

function advanceStreet(state: GameState, extra: LeducHandState): GameState {
  // Reset current bets
  state.players.forEach(p => { p.currentBet = 0 })
  extra.raisesThisRound = 0

  if (state.street === 'preflop') {
    // Deal community card and move to round 2
    state.communityCards = [extra.deck[2]]
    state.street = 'flop' // round 2
    state.currentBetSize = 4
    state.currentPlayerIndex = state.dealerIndex // same first actor in both rounds
    state.betToCall = 0
    state.validActions = ['check', 'bet']
    return state
  }

  // After round 2, go to showdown
  return resolveShowdown(state)
}

function resolveShowdown(state: GameState): GameState {
  const p0 = state.players[0]
  const p1 = state.players[1]
  const community = state.communityCards[0]

  const p0Pair = p0.holeCards[0].rank === community.rank
  const p1Pair = p1.holeCards[0].rank === community.rank
  const v0 = RANK_VALUE[p0.holeCards[0].rank]
  const v1 = RANK_VALUE[p1.holeCards[0].rank]

  state.isHandOver = true
  state.validActions = []

  let winnerIdx: number | null
  if (p0Pair && !p1Pair) {
    winnerIdx = 0
  } else if (p1Pair && !p0Pair) {
    winnerIdx = 1
  } else if (v0 > v1) {
    winnerIdx = 0
  } else if (v1 > v0) {
    winnerIdx = 1
  } else {
    winnerIdx = null // equal ranks: split pot
  }

  if (winnerIdx === null) {
    // Split pot. Contributions are symmetric at showdown so the pot is even,
    // but route any odd chip deterministically to the first-to-act seat.
    const half = Math.floor(state.pot / 2)
    const odd = state.pot - 2 * half
    p0.stack += half
    p1.stack += half
    state.players[state.dealerIndex].stack += odd
    state.winner = null
    state.winAmount = state.pot
  } else {
    state.winner = state.players[winnerIdx].id
    state.winAmount = state.pot
    state.players[winnerIdx].stack += state.pot
  }
  state.pot = 0
  return state
}

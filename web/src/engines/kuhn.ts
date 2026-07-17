import type { Card, GameConfig, GameEngine, GameState, Player, PlayerAction, Action } from './types'
import { mulberry32, shuffle } from './rng'

const KUHN_DECK: Card[] = [
  { rank: 'J', suit: 's' },
  { rank: 'Q', suit: 's' },
  { rank: 'K', suit: 's' },
]

const RANK_VALUE: Record<string, number> = { J: 0, Q: 1, K: 2 }

let globalRng: () => number = Math.random

export const kuhnEngine: GameEngine = {
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
      variant: 'kuhn',
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
      currentBetSize: 1,
      smallBlind: 1,
      bigBlind: 1,
    }
  },

  dealNewHand(state: GameState): GameState {
    const deck = shuffle(KUHN_DECK, globalRng)
    const players = state.players.map((p, i) => ({
      ...p,
      holeCards: [deck[i]],
      folded: false,
      currentBet: 1, // ante
      stack: p.stack - 1,
    }))

    // The "player 0" role (first to act) alternates between seats each hand.
    const dealerIdx = 1 - state.dealerIndex

    const newState: GameState = {
      ...state,
      players,
      communityCards: [],
      pot: 2, // both antes
      currentPlayerIndex: dealerIdx, // first actor alternates each hand
      street: 'preflop',
      isHandOver: false,
      winner: null,
      winAmount: 0,
      handNumber: state.handNumber + 1,
      actionHistory: [],
      betToCall: 0,
      currentBetSize: 1,
      validActions: ['check', 'bet'],
      dealerIndex: dealerIdx,
    }

    return newState
  },

  applyAction(state: GameState, action: PlayerAction): GameState {
    if (!state.validActions.includes(action.type)) {
      throw new Error(
        `kuhn.applyAction: illegal action '${action.type}' for player ${state.currentPlayerIndex}` +
        ` (valid: [${state.validActions.join(', ')}], handOver: ${state.isHandOver})`,
      )
    }

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
      // If this is the second check (opponent checked, now we check), go to showdown
      const prevActions = newState.actionHistory.filter(a => a.street === state.street)
      if (prevActions.length >= 2) {
        return resolveShowdown(newState)
      }
      // First check: move to next player
      newState.currentPlayerIndex = 1 - newState.currentPlayerIndex
      newState.betToCall = 0
      newState.validActions = ['check', 'bet']
      return newState
    }

    if (action.type === 'bet') {
      currentPlayer.stack -= 1
      currentPlayer.currentBet += 1
      newState.pot += 1
      newState.currentPlayerIndex = 1 - newState.currentPlayerIndex
      newState.betToCall = 1
      newState.validActions = ['fold', 'call']
      return newState
    }

    if (action.type === 'call') {
      currentPlayer.stack -= 1
      currentPlayer.currentBet += 1
      newState.pot += 1
      newState.betToCall = 0
      return resolveShowdown(newState)
    }

    return newState
  },

  getValidActions(state: GameState): { actions: Action[]; betSize: number; callAmount: number } {
    return {
      actions: state.validActions,
      betSize: 1,
      callAmount: state.betToCall,
    }
  },
}

function resolveShowdown(state: GameState): GameState {
  const p0 = state.players[0]
  const p1 = state.players[1]
  const v0 = RANK_VALUE[p0.holeCards[0].rank]
  const v1 = RANK_VALUE[p1.holeCards[0].rank]

  state.isHandOver = true
  state.validActions = []

  if (v0 > v1) {
    state.winner = p0.id
    state.winAmount = state.pot
    p0.stack += state.pot
  } else {
    state.winner = p1.id
    state.winAmount = state.pot
    p1.stack += state.pot
  }
  state.pot = 0
  return state
}

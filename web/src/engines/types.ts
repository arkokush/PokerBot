export type Suit = 'h' | 'd' | 'c' | 's'
export type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | 'T' | 'J' | 'Q' | 'K' | 'A'

export interface Card {
  rank: Rank
  suit: Suit
}

export type Action = 'fold' | 'check' | 'call' | 'bet' | 'raise'

export interface PlayerAction {
  type: Action
  amount?: number
}

export type Street = 'preflop' | 'flop' | 'turn' | 'river'

export type GameVariant = 'kuhn' | 'leduc' | 'limit_holdem'

export type PlayMode = 'pvp' | 'pvb' | 'bvb'

export interface Player {
  id: number
  name: string
  stack: number
  holeCards: Card[]
  folded: boolean
  currentBet: number
  isBot: boolean
  botStrategy?: string
}

// Engine-internal per-hand bookkeeping. Lives on GameState (instead of a
// module-level map) so it is copied and discarded along with the rest of the
// hand's state and cannot leak or collide across sessions.
export interface LeducHandState {
  kind: 'leduc'
  /** Shuffled deck for this hand; the community card is deck[2]. */
  deck: Card[]
  /** Bets + raises so far this betting round (the opening bet counts as 1). */
  raisesThisRound: number
}

export interface HoldemHandState {
  kind: 'holdem'
  /** Shuffled deck for this hand; the board is dealt from index 4 onward. */
  deck: Card[]
  /** Bets this round (preflop: the big blind counts as the first bet). */
  betsThisRound: number
  /** True while the BB still has the option to check/raise after an SB limp. */
  optionPending: boolean
}

export type HandInternalState = LeducHandState | HoldemHandState

export interface GameState {
  variant: GameVariant
  players: Player[]
  communityCards: Card[]
  pot: number
  currentPlayerIndex: number
  street: Street
  dealerIndex: number
  isHandOver: boolean
  winner: number | null
  winAmount: number
  handNumber: number
  actionHistory: { playerIndex: number; action: PlayerAction; street: Street }[]
  validActions: Action[]
  betToCall: number
  currentBetSize: number
  smallBlind: number
  bigBlind: number
  /** Engine-internal per-hand state (set by dealNewHand, variant-specific). */
  handState?: HandInternalState
}

export interface GameConfig {
  variant: GameVariant
  startingStack: number
  smallBlind: number
  bigBlind: number
  handLimit: number
  seed?: number
  infiniteStack?: boolean
}

export interface GameEngine {
  createInitialState(config: GameConfig, players: Pick<Player, 'id' | 'name' | 'isBot' | 'botStrategy'>[]): GameState
  dealNewHand(state: GameState): GameState
  applyAction(state: GameState, action: PlayerAction): GameState
  getValidActions(state: GameState): { actions: Action[]; betSize: number; callAmount: number }
}

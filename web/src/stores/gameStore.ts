import { create } from 'zustand'
import type { GameState, GameConfig, PlayerAction, PlayMode, Player } from '../engines/types'
import { getEngine } from '../engines'
import { getBot } from '../bots'
import { useUIStore } from './uiStore'

interface HandRecord {
  handNumber: number
  winner: number | null
  winAmount: number
  actions: GameState['actionHistory']
  players: { id: number; name: string; stack: number; holeCards: Player['holeCards'] }[]
  communityCards: GameState['communityCards']
  /** Net chips gained/lost per player this hand (index by player id) */
  netByPlayer: Record<number, number>
}

interface GameSession {
  id: string
  config: GameConfig
  mode: PlayMode
  state: GameState | null
  handHistory: HandRecord[]
  isRunning: boolean
  bvbSpeed: number // 0.5, 1, 2, 4, or 0 for instant
  /** Stacks at the start of the current hand, used to compute per-hand net */
  preHandStacks: Record<number, number>
}

interface GameStore {
  session: GameSession | null

  startSession: (config: GameConfig, mode: PlayMode, players: Pick<Player, 'id' | 'name' | 'isBot' | 'botStrategy'>[]) => void
  dealHand: () => void
  playerAction: (action: PlayerAction) => void
  botAct: () => Promise<void>
  endSession: () => void
  setBvbSpeed: (speed: number) => void
  stepOneAction: () => void
  stepOneHand: () => void
  toggleRunning: () => void
  stopRunning: () => void
}

export const useGameStore = create<GameStore>((set, get) => ({
  session: null,

  startSession: (config, mode, players) => {
    const engine = getEngine(config.variant)
    const state = engine.createInitialState(config, players)
    const id = crypto.randomUUID()
    const preHandStacks: Record<number, number> = {}
    state.players.forEach((p) => { preHandStacks[p.id] = p.stack })

    // Clear any stale PvP pass-device overlay left over from a previous session
    useUIStore.getState().setPvpWaitingForPass(false)

    set({
      session: {
        id,
        config,
        mode,
        state,
        handHistory: [],
        isRunning: false,
        bvbSpeed: 1,
        preHandStacks,
      },
    })
  },

  dealHand: () => {
    const { session } = get()
    if (!session || !session.state) return
    // Idempotency guard: never deal while a hand is in progress. This makes the
    // initial deal safe under React StrictMode's double-invoked effects — the
    // second call sees handNumber > 0 with a live hand and becomes a no-op.
    if (!session.state.isHandOver && session.state.handNumber > 0) return
    const engine = getEngine(session.config.variant)

    // If infinite stack, reset both players' stacks before dealing
    let stateForDeal = session.state
    if (session.config.infiniteStack) {
      stateForDeal = {
        ...stateForDeal,
        players: stateForDeal.players.map((p) => ({
          ...p,
          stack: session.config.startingStack,
        })),
      }
    }

    // Snapshot stacks before blinds are posted
    const preHandStacks: Record<number, number> = {}
    stateForDeal.players.forEach((p) => { preHandStacks[p.id] = p.stack })

    const newState = engine.dealNewHand(stateForDeal)
    set({
      session: { ...session, state: newState, preHandStacks },
    })
  },

  playerAction: (action) => {
    const { session } = get()
    if (!session || !session.state) return
    const engine = getEngine(session.config.variant)
    const newState = engine.applyAction(session.state, action)

    let handHistory = session.handHistory
    if (newState.isHandOver) {
      const netByPlayer: Record<number, number> = {}
      newState.players.forEach((p) => {
        netByPlayer[p.id] = p.stack - (session.preHandStacks[p.id] ?? session.config.startingStack)
      })

      handHistory = [
        ...handHistory,
        {
          handNumber: newState.handNumber,
          winner: newState.winner,
          winAmount: newState.winAmount,
          actions: newState.actionHistory,
          players: newState.players.map((p) => ({
            id: p.id,
            name: p.name,
            stack: p.stack,
            holeCards: [...p.holeCards],
          })),
          communityCards: [...newState.communityCards],
          netByPlayer,
        },
      ]
    }

    set({
      session: { ...session, state: newState, handHistory },
    })
  },

  botAct: async () => {
    const { session } = get()
    if (!session || !session.state || session.state.isHandOver) return

    const currentPlayer = session.state.players[session.state.currentPlayerIndex]
    if (!currentPlayer.isBot) return

    const bot = getBot(currentPlayer.botStrategy || 'random')
    const action = bot.decide(session.state)
    get().playerAction(action)
  },

  endSession: () => {
    // Clear any pending PvP pass-device overlay so it can't soft-lock the next session
    useUIStore.getState().setPvpWaitingForPass(false)
    set({ session: null })
  },

  setBvbSpeed: (speed) => {
    const { session } = get()
    if (!session) return
    set({ session: { ...session, bvbSpeed: speed } })
  },

  stepOneAction: () => {
    const { session } = get()
    if (!session || !session.state) return
    if (session.state.isHandOver) {
      get().dealHand()
    } else {
      get().botAct()
    }
  },

  stepOneHand: () => {
    const { session } = get()
    if (!session || !session.state) return
    const engine = getEngine(session.config.variant)

    let state = session.state
    let preHandStacks = session.preHandStacks
    if (state.isHandOver) {
      // If infinite stack, reset stacks before dealing
      if (session.config.infiniteStack) {
        state = {
          ...state,
          players: state.players.map((p) => ({
            ...p,
            stack: session.config.startingStack,
          })),
        }
      }
      // Snapshot stacks before dealing
      preHandStacks = {}
      state.players.forEach((p) => { preHandStacks[p.id] = p.stack })
      state = engine.dealNewHand(state)
    }

    while (!state.isHandOver) {
      const currentPlayer = state.players[state.currentPlayerIndex]
      if (currentPlayer.isBot) {
        const bot = getBot(currentPlayer.botStrategy || 'random')
        const action = bot.decide(state)
        state = engine.applyAction(state, action)
      } else {
        break
      }
    }

    let handHistory = session.handHistory
    if (state.isHandOver) {
      const netByPlayer: Record<number, number> = {}
      state.players.forEach((p) => {
        netByPlayer[p.id] = p.stack - (preHandStacks[p.id] ?? session.config.startingStack)
      })

      handHistory = [
        ...handHistory,
        {
          handNumber: state.handNumber,
          winner: state.winner,
          winAmount: state.winAmount,
          actions: state.actionHistory,
          players: state.players.map((p) => ({
            id: p.id,
            name: p.name,
            stack: p.stack,
            holeCards: [...p.holeCards],
          })),
          communityCards: [...state.communityCards],
          netByPlayer,
        },
      ]
    }

    set({ session: { ...session, state, handHistory, preHandStacks } })
  },

  toggleRunning: () => {
    const { session } = get()
    if (!session) return
    set({ session: { ...session, isRunning: !session.isRunning } })
  },

  stopRunning: () => {
    const { session } = get()
    if (!session || !session.isRunning) return
    set({ session: { ...session, isRunning: false } })
  },
}))

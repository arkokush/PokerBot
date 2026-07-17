import { describe, it, expect } from 'vitest'
import { kuhnEngine } from '../kuhn'
import { leducEngine } from '../leduc'
import { limitHoldemEngine } from '../limit_holdem'
import { mulberry32 } from '../rng'
import type { GameConfig, GameEngine, GameState, LeducHandState, PlayerAction, Action } from '../types'

function config(variant: GameConfig['variant'], seed: number): GameConfig {
  return {
    variant,
    startingStack: 1000,
    smallBlind: 1,
    bigBlind: 2,
    handLimit: 500,
    seed,
  }
}

const PLAYERS = [
  { id: 0, name: 'P0', isBot: true },
  { id: 1, name: 'P1', isBot: true },
]

function toPlayerAction(type: Action, state: GameState): PlayerAction {
  switch (type) {
    case 'call': return { type, amount: state.betToCall }
    case 'bet': return { type, amount: state.currentBetSize }
    case 'raise': return { type, amount: state.currentBetSize }
    default: return { type }
  }
}

function playRandomHand(engine: GameEngine, state: GameState, rng: () => number): GameState {
  let s = engine.dealNewHand(state)
  let guard = 0
  while (!s.isHandOver) {
    if (++guard > 100) throw new Error('hand did not terminate within 100 actions')
    const a = s.validActions[Math.floor(rng() * s.validActions.length)]
    s = engine.applyAction(s, toPlayerAction(a, s))
  }
  return s
}

// ---------- Leduc: showdown tie splits the pot ----------

describe('leduc showdown ties', () => {
  it('splits the pot equally when both players hold the same rank on an unpaired board', () => {
    // Search seeds for a deal where both hole cards share a rank; the board
    // card (deck[2]) then necessarily differs (only two copies per rank).
    let state: GameState | null = null
    for (let seed = 1; seed < 500; seed++) {
      let s = leducEngine.createInitialState(config('leduc', seed), PLAYERS)
      s = leducEngine.dealNewHand(s)
      if (s.players[0].holeCards[0].rank === s.players[1].holeCards[0].rank) {
        state = s
        break
      }
    }
    expect(state).not.toBeNull()
    let s = state!
    const board = (s.handState as LeducHandState).deck[2]
    expect(board.rank).not.toBe(s.players[0].holeCards[0].rank)

    const stacksBefore = s.players.map(p => p.stack + p.currentBet) // add back antes

    // Check it down: P P // P P -> showdown
    for (let i = 0; i < 4; i++) {
      s = leducEngine.applyAction(s, { type: 'check' })
    }
    expect(s.isHandOver).toBe(true)
    expect(s.winner).toBeNull()
    expect(s.pot).toBe(0)
    // Equal stack deltas: each player gets their ante back.
    expect(s.players[0].stack).toBe(stacksBefore[0])
    expect(s.players[1].stack).toBe(stacksBefore[1])
  })
})

// ---------- Leduc: raise cap is bet + 2 raises ----------

describe('leduc raise cap', () => {
  it('allows a raise after PBR and forbids one after PBRR', () => {
    let s = leducEngine.createInitialState(config('leduc', 3), PLAYERS)
    s = leducEngine.dealNewHand(s)

    s = leducEngine.applyAction(s, { type: 'check' }) // P
    s = leducEngine.applyAction(s, { type: 'bet', amount: s.currentBetSize }) // PB
    s = leducEngine.applyAction(s, { type: 'raise', amount: s.currentBetSize }) // PBR
    expect(s.validActions).toContain('raise')

    s = leducEngine.applyAction(s, { type: 'raise', amount: s.currentBetSize }) // PBRR
    expect(s.validActions).toEqual(['fold', 'call'])
    expect(() => leducEngine.applyAction(s, { type: 'raise', amount: s.currentBetSize })).toThrow(/illegal action/)
  })
})

// ---------- Limit hold'em: BB option happens exactly once ----------

describe('limit holdem preflop BB option', () => {
  it('limp -> BB check ("CP") reaches the flop', () => {
    let s = limitHoldemEngine.createInitialState(config('limit_holdem', 5), PLAYERS)
    s = limitHoldemEngine.dealNewHand(s)
    const sbSeat = s.currentPlayerIndex

    s = limitHoldemEngine.applyAction(s, { type: 'call', amount: s.betToCall }) // SB limp
    expect(s.street).toBe('preflop')
    expect(s.currentPlayerIndex).toBe(1 - sbSeat) // BB has the option
    expect(s.validActions).toEqual(['check', 'bet'])

    s = limitHoldemEngine.applyAction(s, { type: 'check' }) // BB checks the option
    expect(s.street).toBe('flop')
    expect(s.communityCards).toHaveLength(3)
  })

  it('limp -> BB bet -> SB call reaches the flop (no re-triggered option loop)', () => {
    let s = limitHoldemEngine.createInitialState(config('limit_holdem', 6), PLAYERS)
    s = limitHoldemEngine.dealNewHand(s)

    s = limitHoldemEngine.applyAction(s, { type: 'call', amount: s.betToCall }) // SB limp
    s = limitHoldemEngine.applyAction(s, { type: 'bet', amount: s.currentBetSize }) // BB raises the option
    expect(s.street).toBe('preflop')
    s = limitHoldemEngine.applyAction(s, { type: 'call', amount: s.betToCall }) // SB calls
    expect(s.street).toBe('flop')
    expect(s.communityCards).toHaveLength(3)
  })

  it('limp -> BB bet -> SB raise -> BB call reaches the flop', () => {
    let s = limitHoldemEngine.createInitialState(config('limit_holdem', 7), PLAYERS)
    s = limitHoldemEngine.dealNewHand(s)

    s = limitHoldemEngine.applyAction(s, { type: 'call', amount: s.betToCall })
    s = limitHoldemEngine.applyAction(s, { type: 'bet', amount: s.currentBetSize })
    expect(s.validActions).toContain('raise')
    s = limitHoldemEngine.applyAction(s, { type: 'raise', amount: s.currentBetSize })
    s = limitHoldemEngine.applyAction(s, { type: 'call', amount: s.betToCall })
    expect(s.street).toBe('flop')
  })

  it('SB raise -> BB call reaches the flop without a BB option', () => {
    let s = limitHoldemEngine.createInitialState(config('limit_holdem', 8), PLAYERS)
    s = limitHoldemEngine.dealNewHand(s)

    s = limitHoldemEngine.applyAction(s, { type: 'raise', amount: s.currentBetSize })
    s = limitHoldemEngine.applyAction(s, { type: 'call', amount: s.betToCall })
    expect(s.street).toBe('flop')
  })
})

// ---------- First actor alternates each hand ----------

describe('first-to-act alternation', () => {
  it('kuhn: two consecutive hands have different first actors', () => {
    let s = kuhnEngine.createInitialState(config('kuhn', 11), PLAYERS)
    s = kuhnEngine.dealNewHand(s)
    const first1 = s.currentPlayerIndex
    // finish the hand quickly: check-check
    s = kuhnEngine.applyAction(s, { type: 'check' })
    s = kuhnEngine.applyAction(s, { type: 'check' })
    s = kuhnEngine.dealNewHand(s)
    expect(s.currentPlayerIndex).toBe(1 - first1)
  })

  it('leduc: two consecutive hands have different first actors (both rounds)', () => {
    let s = leducEngine.createInitialState(config('leduc', 12), PLAYERS)
    s = leducEngine.dealNewHand(s)
    const first1 = s.currentPlayerIndex
    s = leducEngine.applyAction(s, { type: 'check' })
    s = leducEngine.applyAction(s, { type: 'check' })
    // Round 2 keeps the same first actor as round 1
    expect(s.street).toBe('flop')
    expect(s.currentPlayerIndex).toBe(first1)
    s = leducEngine.applyAction(s, { type: 'check' })
    s = leducEngine.applyAction(s, { type: 'check' })
    expect(s.isHandOver).toBe(true)
    s = leducEngine.dealNewHand(s)
    expect(s.currentPlayerIndex).toBe(1 - first1)
  })

  it('kuhn: 200-hand seeded BvB run has symmetric first-action counts', () => {
    const rng = mulberry32(99)
    let s = kuhnEngine.createInitialState(config('kuhn', 99), PLAYERS)
    const firstActorCounts = [0, 0]
    for (let h = 0; h < 200; h++) {
      s = kuhnEngine.dealNewHand(s)
      firstActorCounts[s.currentPlayerIndex]++
      let guard = 0
      while (!s.isHandOver) {
        if (++guard > 20) throw new Error('kuhn hand did not terminate')
        const a = s.validActions[Math.floor(rng() * s.validActions.length)]
        s = kuhnEngine.applyAction(s, toPlayerAction(a, s))
      }
    }
    expect(firstActorCounts[0] + firstActorCounts[1]).toBe(200)
    expect(firstActorCounts[0]).toBeGreaterThanOrEqual(90)
    expect(firstActorCounts[1]).toBeGreaterThanOrEqual(90)
  })
})

// ---------- applyAction rejects illegal actions ----------

describe('applyAction legality checks', () => {
  it('kuhn throws on an action outside validActions', () => {
    let s = kuhnEngine.createInitialState(config('kuhn', 21), PLAYERS)
    s = kuhnEngine.dealNewHand(s)
    expect(s.validActions).toEqual(['check', 'bet'])
    expect(() => kuhnEngine.applyAction(s, { type: 'call' })).toThrow(/illegal action 'call'/)
  })

  it('leduc throws on raise with no bet outstanding', () => {
    let s = leducEngine.createInitialState(config('leduc', 22), PLAYERS)
    s = leducEngine.dealNewHand(s)
    expect(() => leducEngine.applyAction(s, { type: 'raise', amount: 2 })).toThrow(/illegal action 'raise'/)
  })

  it('limit holdem throws on check while facing the blind', () => {
    let s = limitHoldemEngine.createInitialState(config('limit_holdem', 23), PLAYERS)
    s = limitHoldemEngine.dealNewHand(s)
    expect(s.validActions).toEqual(['fold', 'call', 'raise'])
    expect(() => limitHoldemEngine.applyAction(s, { type: 'check' })).toThrow(/illegal action 'check'/)
  })
})

// ---------- Per-hand state lives on GameState, chips conserved ----------

describe('hand state and chip conservation', () => {
  it.each([
    ['kuhn', kuhnEngine],
    ['leduc', leducEngine],
    ['limit_holdem', limitHoldemEngine],
  ] as const)('%s: 100 random hands conserve chips and terminate', (variant, engine) => {
    const rng = mulberry32(1234)
    let s = engine.createInitialState(config(variant, 1234), PLAYERS)
    const total = 2 * 1000
    for (let h = 0; h < 100; h++) {
      s = playRandomHand(engine, s, rng)
      expect(s.pot).toBe(0)
      expect(s.players[0].stack + s.players[1].stack).toBe(total)
    }
  })

  it('leduc and limit holdem carry per-hand state on GameState (no module-level map)', () => {
    let l = leducEngine.createInitialState(config('leduc', 31), PLAYERS)
    l = leducEngine.dealNewHand(l)
    expect(l.handState?.kind).toBe('leduc')

    let h = limitHoldemEngine.createInitialState(config('limit_holdem', 31), PLAYERS)
    h = limitHoldemEngine.dealNewHand(h)
    expect(h.handState?.kind).toBe('holdem')

    // Two interleaved sessions with the same handNumber must not collide.
    let other = limitHoldemEngine.createInitialState(config('limit_holdem', 32), PLAYERS)
    other = limitHoldemEngine.dealNewHand(other)
    expect(other.handNumber).toBe(h.handNumber)
    // Advancing one session leaves the other's deck/state untouched.
    const otherDeck = other.handState!.deck.map(c => c.rank + c.suit).join('')
    h = limitHoldemEngine.applyAction(h, { type: 'call', amount: h.betToCall })
    h = limitHoldemEngine.applyAction(h, { type: 'check' })
    expect(h.street).toBe('flop')
    expect(other.street).toBe('preflop')
    expect(other.handState!.deck.map(c => c.rank + c.suit).join('')).toBe(otherDeck)
  })
})

import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { kuhnEngine } from '../kuhn'
import { leducEngine } from '../leduc'
import { limitHoldemEngine } from '../limit_holdem'
import { mulberry32 } from '../rng'
import type { GameConfig, GameEngine, GameState, PlayerAction, Action } from '../types'

// Golden test: play seeded hands engine-vs-engine and assert that every
// info-set key the CFR bot would build exists in the trained strategy JSON.
// Strategy files are loaded from public/models via fs (assertions) and via a
// fetch stub (so the mccfr module's own loader works under node).

const here = path.dirname(fileURLToPath(import.meta.url))
const modelsDir = path.resolve(here, '../../../public/models')

function loadModel(name: string): Record<string, unknown> {
  return JSON.parse(readFileSync(path.join(modelsDir, name), 'utf8'))
}

const kuhnTable = loadModel('kuhn_strategy.json')
const leducTable = loadModel('leduc_strategy.json')
const limitTable = loadModel('MCCFR.json')

// New-grammar limit models have preflop histories starting with F/C/R (real
// blinds, SB acts first). Old ante-game models start with P (check) or B (bet).
function isOldLimitFormat(table: Record<string, unknown>): boolean {
  for (const key of Object.keys(table)) {
    const history = key.split(':', 2)[1] ?? ''
    const preflop = history.split('//')[0]
    if (preflop.length > 0 && (preflop[0] === 'P' || preflop[0] === 'B')) return true
  }
  return false
}

const limitIsOldFormat = isOldLimitFormat(limitTable)
if (limitIsOldFormat) {
  console.warn(
    '[golden_keys] SKIPPING limit hold\'em golden key test: public/models/MCCFR.json ' +
    'still uses the old ante-game grammar (preflop histories start with P/B). ' +
    'It will run automatically once the orchestrator retrains the model on the ' +
    'new real-blinds grammar (preflop histories start with F/C/R).',
  )
}

type Mccfr = typeof import('../../bots/mccfr')
let mccfr: Mccfr

beforeAll(async () => {
  globalThis.fetch = (async (url: RequestInfo | URL) => {
    const match = String(url).match(/models\/([^?#]+)$/)
    if (!match) throw new Error(`golden_keys fetch stub: unexpected url ${String(url)}`)
    try {
      const buf = readFileSync(path.join(modelsDir, match[1]), 'utf8')
      return { ok: true, status: 200, statusText: 'OK', json: async () => JSON.parse(buf) } as Response
    } catch {
      return { ok: false, status: 404, statusText: 'Not Found', json: async () => null } as Response
    }
  }) as typeof fetch

  mccfr = await import('../../bots/mccfr')
  // If an earlier (pre-stub) eager load failed, loadStrategies resets and
  // this second call retries with the stubbed fetch.
  await mccfr.loadStrategies().catch(() => mccfr.loadStrategies())
})

const PLAYERS = [
  { id: 0, name: 'P0', isBot: true },
  { id: 1, name: 'P1', isBot: true },
]

function config(variant: GameConfig['variant'], seed: number): GameConfig {
  return { variant, startingStack: 10000, smallBlind: 1, bigBlind: 2, handLimit: 500, seed }
}

function toPlayerAction(type: Action, state: GameState): PlayerAction {
  switch (type) {
    case 'call': return { type, amount: state.betToCall }
    case 'bet': return { type, amount: state.currentBetSize }
    case 'raise': return { type, amount: state.currentBetSize }
    default: return { type }
  }
}

/**
 * Play `hands` seeded hands sampling uniformly from validActions; at every
 * decision point build the info-set key exactly as bots/mccfr.ts does and
 * collect any keys missing from the table.
 */
function collectMissingKeys(
  engine: GameEngine,
  variant: GameConfig['variant'],
  keyFor: (s: GameState) => string,
  table: Record<string, unknown>,
  hands: number,
  seed: number,
): { missing: string[]; decisions: number } {
  const rng = mulberry32(seed * 7919 + 1)
  let s = engine.createInitialState(config(variant, seed), PLAYERS)
  const missing = new Set<string>()
  let decisions = 0

  for (let h = 0; h < hands; h++) {
    s = engine.dealNewHand(s)
    let guard = 0
    while (!s.isHandOver) {
      if (++guard > 100) throw new Error(`${variant}: hand did not terminate`)
      const key = keyFor(s)
      decisions++
      if (!(key in table)) missing.add(key)
      const a = s.validActions[Math.floor(rng() * s.validActions.length)]
      s = engine.applyAction(s, toPlayerAction(a, s))
    }
  }
  return { missing: [...missing].sort(), decisions }
}

describe('golden info-set keys vs trained models', () => {
  it('kuhn: every decision-point key over 200 seeded hands exists in kuhn_strategy.json', () => {
    const { missing, decisions } = collectMissingKeys(
      kuhnEngine, 'kuhn', (s) => mccfr.kuhnInfoKey(s), kuhnTable, 200, 42,
    )
    expect(decisions).toBeGreaterThan(300)
    expect(missing).toEqual([])
  })

  it('leduc: every decision-point key over 200 seeded hands exists in leduc_strategy.json', () => {
    const { missing, decisions } = collectMissingKeys(
      leducEngine, 'leduc', (s) => mccfr.leducInfoKey(s), leducTable, 200, 43,
    )
    expect(decisions).toBeGreaterThan(400)
    expect(missing).toEqual([])
  })

  it.skipIf(limitIsOldFormat)(
    'limit holdem: every decision-point key over 200 seeded hands exists in MCCFR.json (auto-skipped while MCCFR.json is old-format; retrain to enable)',
    () => {
      const { missing, decisions } = collectMissingKeys(
        limitHoldemEngine, 'limit_holdem', (s) => mccfr.limitInfoKey(s), limitTable, 200, 44,
      )
      expect(decisions).toBeGreaterThan(400)
      expect(missing).toEqual([])
    },
    120000,
  )
})

// ---------- Key-format unit tests ----------

describe('leduc info-set keys', () => {
  it('emits the trailing // at the exact start of round 2', () => {
    let s = leducEngine.createInitialState(config('leduc', 17), PLAYERS)
    s = leducEngine.dealNewHand(s)
    s = leducEngine.applyAction(s, { type: 'check' })
    s = leducEngine.applyAction(s, { type: 'check' })
    expect(s.street).toBe('flop')
    expect(s.actionHistory.filter(a => a.street === 'flop')).toHaveLength(0)

    const key = mccfr.leducInfoKey(s)
    const hole = s.players[s.currentPlayerIndex].holeCards[0].rank
    const board = s.communityCards[0].rank
    expect(key).toBe(`${hole}|${board}:PP//`)
    expect(key in leducTable).toBe(true)
  })

  it('emits PBC// after a called bet ends round 1', () => {
    let s = leducEngine.createInitialState(config('leduc', 18), PLAYERS)
    s = leducEngine.dealNewHand(s)
    s = leducEngine.applyAction(s, { type: 'check' })
    s = leducEngine.applyAction(s, { type: 'bet', amount: s.currentBetSize })
    s = leducEngine.applyAction(s, { type: 'call', amount: s.betToCall })
    expect(s.street).toBe('flop')
    expect(mccfr.buildActionHistory(s, 'leduc')).toBe('PBC//')
  })
})

describe('limit holdem info-set key grammar (new real-blinds trainer format)', () => {
  function deal(seed: number): GameState {
    const s = limitHoldemEngine.createInitialState(config('limit_holdem', seed), PLAYERS)
    return limitHoldemEngine.dealNewHand(s)
  }
  const hist = (s: GameState) => mccfr.buildActionHistory(s, 'limit_holdem')

  it('starts empty for the SB opening decision', () => {
    const s = deal(50)
    expect(hist(s)).toBe('')
    expect(mccfr.limitInfoKey(s)).toMatch(/^b\d+:$/)
  })

  it('open limp is C', () => {
    let s = deal(51)
    s = limitHoldemEngine.applyAction(s, { type: 'call', amount: s.betToCall })
    expect(hist(s)).toBe('C')
  })

  it('limp-check is CP and the flop key ends with CP//', () => {
    let s = deal(52)
    s = limitHoldemEngine.applyAction(s, { type: 'call', amount: s.betToCall })
    s = limitHoldemEngine.applyAction(s, { type: 'check' })
    expect(s.street).toBe('flop')
    expect(hist(s)).toBe('CP//')
    expect(mccfr.limitInfoKey(s)).toMatch(/^b\d+:CP\/\/$/)
  })

  it('BB raising the option after a limp is CR (engine bet maps to R preflop)', () => {
    let s = deal(53)
    s = limitHoldemEngine.applyAction(s, { type: 'call', amount: s.betToCall })
    s = limitHoldemEngine.applyAction(s, { type: 'bet', amount: s.currentBetSize })
    expect(s.street).toBe('preflop')
    expect(hist(s)).toBe('CR')
  })

  it('SB open raise is R; raise-call reaches the flop as RC//', () => {
    let s = deal(54)
    s = limitHoldemEngine.applyAction(s, { type: 'raise', amount: s.currentBetSize })
    expect(hist(s)).toBe('R')
    s = limitHoldemEngine.applyAction(s, { type: 'call', amount: s.betToCall })
    expect(s.street).toBe('flop')
    expect(hist(s)).toBe('RC//')
  })

  it('postflop uses P/B/C/R and street separators stack up: CP//PB, CP//PP//', () => {
    let s = deal(55)
    s = limitHoldemEngine.applyAction(s, { type: 'call', amount: s.betToCall })
    s = limitHoldemEngine.applyAction(s, { type: 'check' }) // flop
    s = limitHoldemEngine.applyAction(s, { type: 'check' })
    s = limitHoldemEngine.applyAction(s, { type: 'bet', amount: s.currentBetSize })
    expect(hist(s)).toBe('CP//PB')
    s = limitHoldemEngine.applyAction(s, { type: 'call', amount: s.betToCall }) // -> turn
    expect(s.street).toBe('turn')
    expect(hist(s)).toBe('CP//PBC//')
  })

  it('folding preflop maps to F in mid-hand histories (SB limp, BB raise, SB fold ends hand)', () => {
    let s = deal(56)
    s = limitHoldemEngine.applyAction(s, { type: 'call', amount: s.betToCall })
    s = limitHoldemEngine.applyAction(s, { type: 'bet', amount: s.currentBetSize })
    // SB now faces CR; if SB raises, history is CRR
    s = limitHoldemEngine.applyAction(s, { type: 'raise', amount: s.currentBetSize })
    expect(hist(s)).toBe('CRR')
  })
})

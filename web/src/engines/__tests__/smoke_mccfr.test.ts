import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { limitHoldemEngine } from '../limit_holdem'
import { alwaysCallBot } from '../../bots/always_call'
import type { GameConfig } from '../types'

const here = path.dirname(fileURLToPath(import.meta.url))
const modelsDir = path.resolve(here, '../../../public/models')

beforeAll(() => {
  // Stub fetch so mccfr.ts can load JSON from the local public/models dir.
  globalThis.fetch = (async (url: RequestInfo | URL) => {
    const u = String(url)
    const match = u.match(/models\/([^?#]+)$/)
    if (!match) throw new Error(`smoke fetch: unexpected url ${u}`)
    const file = path.join(modelsDir, match[1])
    try {
      const buf = readFileSync(file, 'utf8')
      return { ok: true, status: 200, statusText: 'OK', json: async () => JSON.parse(buf) } as Response
    } catch {
      return { ok: false, status: 404, statusText: 'Not Found', json: async () => null } as Response
    }
  }) as typeof fetch
})

function buildConfig(seed: number): GameConfig {
  return {
    variant: 'limit_holdem',
    startingStack: 1000,
    smallBlind: 1,
    bigBlind: 2,
    handLimit: 100,
    seed,
    infiniteStack: true,
  }
}

describe('MCCFR bot vs always_call smoke (limit holdem, 100 hands)', () => {
  it('completes 100 hands with only legal actions, conserved chips, and sane latency', async () => {
    // Import mccfr LAZILY so fetch is already stubbed, then wait for the
    // strategy load kicked off at module import to finish.
    const { mccfrBot, loadStrategies } = await import('../../bots/mccfr')
    await loadStrategies().catch(() => loadStrategies())

    const config = buildConfig(42)
    const players = [
      { id: 0, name: 'MCCFR', isBot: true, botStrategy: 'mccfr' as const },
      { id: 1, name: 'Caller', isBot: true, botStrategy: 'always_call' as const },
    ]
    let state = limitHoldemEngine.createInitialState(config, players)
    const totalChips = 2 * config.startingStack

    const latencies: { street: string; ms: number }[] = []
    let handsCompleted = 0
    let mccfrDecisions = 0

    for (let h = 0; h < 100; h++) {
      state = limitHoldemEngine.dealNewHand(state)
      let guard = 0
      while (!state.isHandOver) {
        // A hand of heads-up limit holdem is bounded by the bet caps; anything
        // past this indicates a betting-round loop (the old BB-option bug).
        if (++guard > 60) throw new Error(`hand ${h + 1} did not terminate (betting loop?)`)

        const actor = state.players[state.currentPlayerIndex]
        let action
        if (actor.botStrategy === 'mccfr') {
          const t0 = performance.now()
          action = mccfrBot.decide(state)
          latencies.push({ street: state.street, ms: performance.now() - t0 })
          mccfrDecisions++
        } else {
          action = alwaysCallBot.decide(state)
        }

        // Bots must only emit legal actions (clamped in the bot layer); the
        // engine also throws on illegal input, which would fail this test.
        expect(state.validActions).toContain(action.type)
        state = limitHoldemEngine.applyAction(state, action)
      }
      handsCompleted++
      // Chip conservation after every hand: no chips created or destroyed.
      expect(state.pot).toBe(0)
      expect(state.players[0].stack + state.players[1].stack).toBe(totalChips)
    }

    expect(handsCompleted).toBe(100)
    expect(mccfrDecisions).toBeGreaterThan(100)

    const all = latencies.map(l => l.ms)
    const avg = all.reduce((a, b) => a + b, 0) / all.length
    const flopTurnMax = Math.max(0, ...latencies.filter(l => l.street === 'flop' || l.street === 'turn').map(l => l.ms))
    const riverMax = Math.max(0, ...latencies.filter(l => l.street === 'river').map(l => l.ms))

    // eslint-disable-next-line no-console
    console.log(`[smoke] ${mccfrDecisions} MCCFR decisions over ${handsCompleted} hands; latency avg ${avg.toFixed(2)}ms, flop/turn max ${flopTurnMax.toFixed(2)}ms, river max ${riverMax.toFixed(2)}ms`)

    // Latency budgets: equity bucketing does 100 MC rollouts (flop/turn) or an
    // exact C(45,2) enumeration (river); both should be far under these caps.
    expect(avg).toBeLessThan(50)
    expect(flopTurnMax).toBeLessThan(250)
    expect(riverMax).toBeLessThan(1000)
  }, 30000)
})

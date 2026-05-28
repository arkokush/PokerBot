import { describe, it, expect } from 'vitest'
import type { Card, Rank, Suit } from '../types'
import { mcWinProb, riverWinProb } from '../equity'
import { mulberry32 } from '../rng'

function parseCard(s: string): Card {
  return { rank: s[0] as Rank, suit: s[1] as Suit }
}
const h = (cards: string[]): Card[] => cards.map(parseCard)

// Reference values come from scripts/compute_test_equities.py.
// Regenerate if the Python equity logic changes.

describe('riverWinProb (exact enumeration, ±0.001 of phevaluator references)', () => {
  it('AsKs on Qh Jd Tc 5h 2c (nut Broadway straight) ~ 0.995455', () => {
    const eq = riverWinProb(h(['As', 'Ks']), h(['Qh', 'Jd', 'Tc', '5h', '2c']))
    expect(eq).toBeCloseTo(0.995455, 3)
  })

  it('7c2d on Kh 9d 4c 5h 3s (no equity) ~ 0.004545', () => {
    const eq = riverWinProb(h(['7c', '2d']), h(['Kh', '9d', '4c', '5h', '3s']))
    expect(eq).toBeCloseTo(0.004545, 3)
  })

  it('AhAd on Ac 9d 4c 5h 2s (trip aces) ~ 0.828283', () => {
    const eq = riverWinProb(h(['Ah', 'Ad']), h(['Ac', '9d', '4c', '5h', '2s']))
    expect(eq).toBeCloseTo(0.828283, 3)
  })
})

describe('mcWinProb flop (k=5000, ±0.03 of Python references)', () => {
  it('AsKs on Qh Jd 2c ~ 0.606', () => {
    const rng = mulberry32(0)
    const eq = mcWinProb(h(['As', 'Ks']), h(['Qh', 'Jd', '2c']), 5000, rng)
    expect(eq).toBeCloseTo(0.6062, 1.5) // tolerance ±0.03
    expect(Math.abs(eq - 0.6062)).toBeLessThanOrEqual(0.03)
  })

  it('AhAd on 7c 5d 2s ~ 0.842', () => {
    const rng = mulberry32(0)
    const eq = mcWinProb(h(['Ah', 'Ad']), h(['7c', '5d', '2s']), 5000, rng)
    expect(Math.abs(eq - 0.8422)).toBeLessThanOrEqual(0.03)
  })

  it('9h8h on 7h 6d 2c ~ 0.513', () => {
    const rng = mulberry32(0)
    const eq = mcWinProb(h(['9h', '8h']), h(['7h', '6d', '2c']), 5000, rng)
    expect(Math.abs(eq - 0.5130)).toBeLessThanOrEqual(0.03)
  })
})

describe('mcWinProb turn (k=5000, ±0.03 of Python references)', () => {
  it('QhQd on Qs 8c 3d 2h ~ 0.988', () => {
    const rng = mulberry32(0)
    const eq = mcWinProb(h(['Qh', 'Qd']), h(['Qs', '8c', '3d', '2h']), 5000, rng)
    expect(Math.abs(eq - 0.9876)).toBeLessThanOrEqual(0.03)
  })

  it('AsKs on Qs 7s 2d 5h ~ 0.595', () => {
    const rng = mulberry32(0)
    const eq = mcWinProb(h(['As', 'Ks']), h(['Qs', '7s', '2d', '5h']), 5000, rng)
    expect(Math.abs(eq - 0.5953)).toBeLessThanOrEqual(0.03)
  })
})

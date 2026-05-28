import { describe, it, expect } from 'vitest'
import type { Card, Rank, Suit } from '../types'
import { evalHand } from '../hand_eval'

function c(rank: Rank, suit: Suit): Card {
  return { rank, suit }
}

// Lower eval = stronger.
function stronger(a: Card[], b: Card[]): void {
  expect(evalHand(a)).toBeLessThan(evalHand(b))
}

describe('hand_eval - one of each class, ordered', () => {
  // Build a representative hand in each class and verify monotonic ordering.
  const straightFlush = [c('9', 'h'), c('T', 'h'), c('J', 'h'), c('Q', 'h'), c('K', 'h')]
  const quads = [c('A', 'h'), c('A', 'd'), c('A', 'c'), c('A', 's'), c('2', 'h')]
  const fullHouse = [c('K', 'h'), c('K', 'd'), c('K', 'c'), c('Q', 'h'), c('Q', 'd')]
  const flush = [c('2', 'h'), c('5', 'h'), c('7', 'h'), c('9', 'h'), c('K', 'h')]
  const straight = [c('5', 'h'), c('6', 'd'), c('7', 'c'), c('8', 'h'), c('9', 's')]
  const trips = [c('Q', 'h'), c('Q', 'd'), c('Q', 'c'), c('5', 'h'), c('2', 'd')]
  const twoPair = [c('J', 'h'), c('J', 'd'), c('4', 'c'), c('4', 's'), c('2', 'h')]
  const pair = [c('T', 'h'), c('T', 'd'), c('5', 'c'), c('3', 'h'), c('2', 's')]
  const highCard = [c('A', 'h'), c('Q', 'd'), c('9', 'c'), c('5', 'h'), c('2', 's')]

  it('orders categories correctly', () => {
    stronger(straightFlush, quads)
    stronger(quads, fullHouse)
    stronger(fullHouse, flush)
    stronger(flush, straight)
    stronger(straight, trips)
    stronger(trips, twoPair)
    stronger(twoPair, pair)
    stronger(pair, highCard)
  })
})

describe('hand_eval - straight nuances', () => {
  it('wheel A-2-3-4-5 is the weakest straight', () => {
    const wheel = [c('A', 'h'), c('2', 'd'), c('3', 'c'), c('4', 'h'), c('5', 's')]
    const sixHigh = [c('2', 'h'), c('3', 'd'), c('4', 'c'), c('5', 'h'), c('6', 's')]
    stronger(sixHigh, wheel)
  })

  it('Broadway A-K-Q-J-T is the strongest non-flush straight', () => {
    const broadway = [c('T', 'h'), c('J', 'd'), c('Q', 'c'), c('K', 'h'), c('A', 's')]
    const nineHigh = [c('5', 'h'), c('6', 'd'), c('7', 'c'), c('8', 'h'), c('9', 's')]
    stronger(broadway, nineHigh)
  })

  it('wheel does NOT count as straight if a higher straight exists in same 7 cards', () => {
    // 7-card scenario: A-2-3-4-5-6-7 contains a 7-high straight, not the wheel.
    const sevenCard = [c('A', 'h'), c('2', 'd'), c('3', 'c'), c('4', 'h'), c('5', 's'), c('6', 'd'), c('7', 'c')]
    const sevenHighStraight = [c('3', 'h'), c('4', 'd'), c('5', 'c'), c('6', 'h'), c('7', 's')]
    // The 7-card eval should equal the 7-high straight (best 5)
    expect(evalHand(sevenCard)).toBe(evalHand(sevenHighStraight))
  })
})

describe('hand_eval - flush kicker ordering', () => {
  it('flushes are ordered by high card', () => {
    const flushKHigh = [c('2', 'h'), c('5', 'h'), c('7', 'h'), c('9', 'h'), c('K', 'h')]
    const flushQHigh = [c('2', 'h'), c('5', 'h'), c('7', 'h'), c('9', 'h'), c('Q', 'h')]
    stronger(flushKHigh, flushQHigh)
  })
})

describe('hand_eval - two pair kicker ordering', () => {
  it('same two pairs, different kickers', () => {
    const aceKicker = [c('J', 'h'), c('J', 'd'), c('4', 'c'), c('4', 's'), c('A', 'h')]
    const twoKicker = [c('J', 'h'), c('J', 'd'), c('4', 'c'), c('4', 's'), c('2', 'h')]
    stronger(aceKicker, twoKicker)
  })

  it('two pair: higher top pair wins regardless of bottom pair', () => {
    const kkAndAces = [c('K', 'h'), c('K', 'd'), c('2', 'c'), c('2', 's'), c('5', 'h')]
    const qqAndJacks = [c('Q', 'h'), c('Q', 'd'), c('J', 'c'), c('J', 's'), c('5', 'h')]
    stronger(kkAndAces, qqAndJacks)
  })
})

describe('hand_eval - 7-card best-of-21', () => {
  it('picks the flush over a lower straight', () => {
    // 5 hearts available + a non-flush straight that's lower
    const cards = [c('2', 'h'), c('5', 'h'), c('7', 'h'), c('9', 'h'), c('K', 'h'), c('3', 'd'), c('4', 'c')]
    const flushOnly = [c('2', 'h'), c('5', 'h'), c('7', 'h'), c('9', 'h'), c('K', 'h')]
    expect(evalHand(cards)).toBe(evalHand(flushOnly))
  })
})

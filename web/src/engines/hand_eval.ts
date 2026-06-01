import type { Card, Rank, Suit } from './types'

// 7-card poker hand evaluator. Returns an integer where LOWER = STRONGER,
// matching phevaluator's convention so cross-checking against Python is mechanical.
//
// Cards are encoded as a 6-bit int: (rank * 4) + suit, range 0..51.
// Ranks: 2=0, 3=1, ..., K=11, A=12.
// Suits: h=0, d=1, c=2, s=3.

const RANK_LABELS: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A']
const SUIT_LABELS: Suit[] = ['h', 'd', 'c', 's']

const RANK_INDEX: Record<string, number> = {}
RANK_LABELS.forEach((r, i) => { RANK_INDEX[r] = i })
const SUIT_INDEX: Record<string, number> = {}
SUIT_LABELS.forEach((s, i) => { SUIT_INDEX[s] = i })

export function encodeCard(card: Card): number {
  return RANK_INDEX[card.rank] * 4 + SUIT_INDEX[card.suit]
}

export function encodeCards(cards: Card[]): number[] {
  const out = new Array<number>(cards.length)
  for (let i = 0; i < cards.length; i++) out[i] = encodeCard(cards[i])
  return out
}

const CAT_STRAIGHT_FLUSH = 0
const CAT_QUADS = 1
const CAT_FULL_HOUSE = 2
const CAT_FLUSH = 3
const CAT_STRAIGHT = 4
const CAT_TRIPS = 5
const CAT_TWO_PAIR = 6
const CAT_PAIR = 7
const CAT_HIGH_CARD = 8

const CAT_STRIDE = 1 << 24

// Returns straight high rank (4..12 normal, 3 for wheel) or -1.
function straightHighFromBits(bits: number): number {
  for (let high = 12; high >= 4; high--) {
    const mask = 0x1F << (high - 4)
    if ((bits & mask) === mask) return high
  }
  if ((bits & 0x100F) === 0x100F) return 3
  return -1
}

// Shared scratch buffer; single-threaded JS makes this safe.
const scratchCounts = new Int32Array(13)

function eval5(c0: number, c1: number, c2: number, c3: number, c4: number): number {
  const r0 = c0 >> 2, r1 = c1 >> 2, r2 = c2 >> 2, r3 = c3 >> 2, r4 = c4 >> 2
  const s0 = c0 & 3, s1 = c1 & 3, s2 = c2 & 3, s3 = c3 & 3, s4 = c4 & 3

  const isFlush = s0 === s1 && s1 === s2 && s2 === s3 && s3 === s4

  scratchCounts.fill(0)
  scratchCounts[r0]++; scratchCounts[r1]++; scratchCounts[r2]++; scratchCounts[r3]++; scratchCounts[r4]++

  const rankBits = (1 << r0) | (1 << r1) | (1 << r2) | (1 << r3) | (1 << r4)

  let quadR = -1, tripR = -1, pair1R = -1, pair2R = -1
  let k0 = -1, k1 = -1, k2 = -1, k3 = -1, k4 = -1
  let kIdx = 0
  for (let r = 12; r >= 0; r--) {
    const c = scratchCounts[r]
    if (c === 0) continue
    if (c === 4) quadR = r
    else if (c === 3) tripR = r
    else if (c === 2) {
      if (pair1R < 0) pair1R = r
      else pair2R = r
    } else {
      if (kIdx === 0) k0 = r
      else if (kIdx === 1) k1 = r
      else if (kIdx === 2) k2 = r
      else if (kIdx === 3) k3 = r
      else k4 = r
      kIdx++
    }
  }

  const sHigh = straightHighFromBits(rankBits)
  const isStraight = sHigh >= 0

  if (isStraight && isFlush) {
    return CAT_STRAIGHT_FLUSH * CAT_STRIDE + (12 - sHigh)
  }
  if (quadR >= 0) {
    return CAT_QUADS * CAT_STRIDE + (12 - quadR) * 13 + (12 - k0)
  }
  if (tripR >= 0 && pair1R >= 0) {
    return CAT_FULL_HOUSE * CAT_STRIDE + (12 - tripR) * 13 + (12 - pair1R)
  }
  if (isFlush) {
    return CAT_FLUSH * CAT_STRIDE + ((((12 - k0) * 13 + (12 - k1)) * 13 + (12 - k2)) * 13 + (12 - k3)) * 13 + (12 - k4)
  }
  if (isStraight) {
    return CAT_STRAIGHT * CAT_STRIDE + (12 - sHigh)
  }
  if (tripR >= 0) {
    return CAT_TRIPS * CAT_STRIDE + ((12 - tripR) * 13 + (12 - k0)) * 13 + (12 - k1)
  }
  if (pair2R >= 0) {
    return CAT_TWO_PAIR * CAT_STRIDE + ((12 - pair1R) * 13 + (12 - pair2R)) * 13 + (12 - k0)
  }
  if (pair1R >= 0) {
    return CAT_PAIR * CAT_STRIDE + ((((12 - pair1R) * 13 + (12 - k0)) * 13 + (12 - k1)) * 13 + (12 - k2))
  }
  return CAT_HIGH_CARD * CAT_STRIDE + ((((12 - k0) * 13 + (12 - k1)) * 13 + (12 - k2)) * 13 + (12 - k3)) * 13 + (12 - k4)
}

export function eval7(cards: number[]): number {
  const c0 = cards[0], c1 = cards[1], c2 = cards[2], c3 = cards[3], c4 = cards[4], c5 = cards[5], c6 = cards[6]
  let best = eval5(c0, c1, c2, c3, c4)
  let v = eval5(c0, c1, c2, c3, c5); if (v < best) best = v
  v = eval5(c0, c1, c2, c3, c6); if (v < best) best = v
  v = eval5(c0, c1, c2, c4, c5); if (v < best) best = v
  v = eval5(c0, c1, c2, c4, c6); if (v < best) best = v
  v = eval5(c0, c1, c2, c5, c6); if (v < best) best = v
  v = eval5(c0, c1, c3, c4, c5); if (v < best) best = v
  v = eval5(c0, c1, c3, c4, c6); if (v < best) best = v
  v = eval5(c0, c1, c3, c5, c6); if (v < best) best = v
  v = eval5(c0, c1, c4, c5, c6); if (v < best) best = v
  v = eval5(c0, c2, c3, c4, c5); if (v < best) best = v
  v = eval5(c0, c2, c3, c4, c6); if (v < best) best = v
  v = eval5(c0, c2, c3, c5, c6); if (v < best) best = v
  v = eval5(c0, c2, c4, c5, c6); if (v < best) best = v
  v = eval5(c0, c3, c4, c5, c6); if (v < best) best = v
  v = eval5(c1, c2, c3, c4, c5); if (v < best) best = v
  v = eval5(c1, c2, c3, c4, c6); if (v < best) best = v
  v = eval5(c1, c2, c3, c5, c6); if (v < best) best = v
  v = eval5(c1, c2, c4, c5, c6); if (v < best) best = v
  v = eval5(c1, c3, c4, c5, c6); if (v < best) best = v
  v = eval5(c2, c3, c4, c5, c6); if (v < best) best = v
  return best
}

export function evalHand(cards: Card[]): number {
  if (cards.length === 5) {
    return eval5(encodeCard(cards[0]), encodeCard(cards[1]), encodeCard(cards[2]), encodeCard(cards[3]), encodeCard(cards[4]))
  }
  if (cards.length === 7) {
    return eval7(encodeCards(cards))
  }
  throw new Error(`evalHand: unsupported card count ${cards.length}`)
}

const RANK_NAMES: Record<Rank, string> = {
  '2': 'Two', '3': 'Three', '4': 'Four', '5': 'Five', '6': 'Six',
  '7': 'Seven', '8': 'Eight', '9': 'Nine', 'T': 'Ten',
  'J': 'Jack', 'Q': 'Queen', 'K': 'King', 'A': 'Ace',
}

const RANK_NAMES_PLURAL: Record<Rank, string> = {
  '2': 'Twos', '3': 'Threes', '4': 'Fours', '5': 'Fives', '6': 'Sixes',
  '7': 'Sevens', '8': 'Eights', '9': 'Nines', 'T': 'Tens',
  'J': 'Jacks', 'Q': 'Queens', 'K': 'Kings', 'A': 'Aces',
}

function rankIdxName(i: number): string {
  return RANK_NAMES[RANK_LABELS[i]]
}

function rankIdxPlural(i: number): string {
  return RANK_NAMES_PLURAL[RANK_LABELS[i]]
}

function describe5Encoded(c0: number, c1: number, c2: number, c3: number, c4: number): string {
  const ranks = [c0 >> 2, c1 >> 2, c2 >> 2, c3 >> 2, c4 >> 2].sort((a, b) => b - a)
  const suits = [c0 & 3, c1 & 3, c2 & 3, c3 & 3, c4 & 3]
  const isFlush = suits.every((s) => s === suits[0])

  const counts = new Array<number>(13).fill(0)
  for (const r of ranks) counts[r]++

  let quadR = -1, tripR = -1, pair1R = -1, pair2R = -1
  for (let r = 12; r >= 0; r--) {
    if (counts[r] === 4) quadR = r
    else if (counts[r] === 3) tripR = r
    else if (counts[r] === 2) {
      if (pair1R < 0) pair1R = r
      else pair2R = r
    }
  }

  const rankBits = ranks.reduce((b, r) => b | (1 << r), 0)
  const sHigh = straightHighFromBits(rankBits)
  const isStraight = sHigh >= 0

  if (isStraight && isFlush) {
    if (sHigh === 12) return 'Royal Flush'
    return `Straight Flush, ${rankIdxName(sHigh)} high`
  }
  if (quadR >= 0) return `Four of a Kind, ${rankIdxPlural(quadR)}`
  if (tripR >= 0 && pair1R >= 0) return `Full House, ${rankIdxPlural(tripR)} over ${rankIdxPlural(pair1R)}`
  if (isFlush) return `Flush, ${rankIdxName(ranks[0])} high`
  if (isStraight) return `Straight, ${rankIdxName(sHigh)} high`
  if (tripR >= 0) return `Three of a Kind, ${rankIdxPlural(tripR)}`
  if (pair2R >= 0) return `Two Pair, ${rankIdxPlural(pair1R)} and ${rankIdxPlural(pair2R)}`
  if (pair1R >= 0) return `Pair of ${rankIdxPlural(pair1R)}`
  return `${rankIdxName(ranks[0])} High`
}

function describeBestEncoded(cards: number[]): string {
  const n = cards.length
  if (n === 5) return describe5Encoded(cards[0], cards[1], cards[2], cards[3], cards[4])
  let bestScore = Infinity
  let b0 = cards[0], b1 = cards[1], b2 = cards[2], b3 = cards[3], b4 = cards[4]
  for (let i0 = 0; i0 < n - 4; i0++)
    for (let i1 = i0 + 1; i1 < n - 3; i1++)
      for (let i2 = i1 + 1; i2 < n - 2; i2++)
        for (let i3 = i2 + 1; i3 < n - 1; i3++)
          for (let i4 = i3 + 1; i4 < n; i4++) {
            const score = eval5(cards[i0], cards[i1], cards[i2], cards[i3], cards[i4])
            if (score < bestScore) {
              bestScore = score
              b0 = cards[i0]; b1 = cards[i1]; b2 = cards[i2]; b3 = cards[i3]; b4 = cards[i4]
            }
          }
  return describe5Encoded(b0, b1, b2, b3, b4)
}

export function describeHand(cards: Card[]): string {
  if (cards.length === 0) return ''
  if (cards.length === 1) {
    return `${RANK_NAMES[cards[0].rank]} High`
  }
  if (cards.length === 2) {
    if (cards[0].rank === cards[1].rank) {
      return `Pair of ${RANK_NAMES_PLURAL[cards[0].rank]}`
    }
    const r0 = RANK_INDEX[cards[0].rank]
    const r1 = RANK_INDEX[cards[1].rank]
    const high = r0 > r1 ? cards[0].rank : cards[1].rank
    return `${RANK_NAMES[high]} High`
  }
  if (cards.length >= 5) {
    return describeBestEncoded(encodeCards(cards))
  }
  // 3-4 cards: fall back to pair/high-card check
  const counts: Record<string, number> = {}
  let highIdx = -1
  for (const c of cards) {
    counts[c.rank] = (counts[c.rank] || 0) + 1
    if (RANK_INDEX[c.rank] > highIdx) highIdx = RANK_INDEX[c.rank]
  }
  for (const rank of Object.keys(counts)) {
    if (counts[rank] >= 2) return `Pair of ${RANK_NAMES_PLURAL[rank as Rank]}`
  }
  return `${RANK_NAMES[RANK_LABELS[highIdx]]} High`
}

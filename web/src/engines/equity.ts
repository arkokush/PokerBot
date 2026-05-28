import type { Card } from './types'
import { encodeCard, eval7 } from './hand_eval'

// Heads-up equity calculation, mirroring src/utils/equity.py.
// - mcWinProb: Monte Carlo rollouts vs random opponent on flop/turn.
// - riverWinProb: exact enumeration over remaining C(45, 2) opponent holdings.
// Tie semantics match Python: ties contribute 0.5.

function remainingDeck(known: number[]): number[] {
  const seen = new Uint8Array(52)
  for (const c of known) seen[c] = 1
  const out: number[] = []
  for (let c = 0; c < 52; c++) if (seen[c] === 0) out.push(c)
  return out
}

// In-place Fisher-Yates to move the first k elements to a uniform random sample without replacement.
function partialShuffle(arr: number[], k: number, rng: () => number): void {
  const n = arr.length
  for (let i = 0; i < k; i++) {
    const j = i + ((rng() * (n - i)) | 0)
    const tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp
  }
}

export function mcWinProb(hole: Card[], board: Card[], k: number, rng: () => number = Math.random): number {
  if (hole.length !== 2) throw new Error(`mcWinProb: hole must be 2 cards, got ${hole.length}`)
  if (board.length !== 3 && board.length !== 4) {
    throw new Error(`mcWinProb: board must be 3 or 4 cards, got ${board.length}`)
  }
  const h0 = encodeCard(hole[0])
  const h1 = encodeCard(hole[1])
  const boardEnc = board.map(encodeCard)
  const deck = remainingDeck([h0, h1, ...boardEnc])
  const remaining = 5 - boardEnc.length

  // Pre-sized buffers for the 7-card evaluations.
  const myHand = new Array<number>(7)
  myHand[0] = h0; myHand[1] = h1
  const oppHand = new Array<number>(7)

  let wins = 0
  for (let r = 0; r < k; r++) {
    partialShuffle(deck, 2 + remaining, rng)
    const opp0 = deck[0], opp1 = deck[1]
    // Fill board: existing board cards + sampled runout
    for (let i = 0; i < boardEnc.length; i++) {
      myHand[2 + i] = boardEnc[i]
      oppHand[2 + i] = boardEnc[i]
    }
    for (let i = 0; i < remaining; i++) {
      const c = deck[2 + i]
      myHand[2 + boardEnc.length + i] = c
      oppHand[2 + boardEnc.length + i] = c
    }
    oppHand[0] = opp0
    oppHand[1] = opp1

    const myVal = eval7(myHand)
    const oppVal = eval7(oppHand)
    if (myVal < oppVal) wins += 2
    else if (myVal === oppVal) wins += 1
  }
  return wins / (2 * k)
}

export function riverWinProb(hole: Card[], board: Card[]): number {
  if (hole.length !== 2) throw new Error(`riverWinProb: hole must be 2 cards`)
  if (board.length !== 5) throw new Error(`riverWinProb: board must be 5 cards, got ${board.length}`)
  const h0 = encodeCard(hole[0])
  const h1 = encodeCard(hole[1])
  const boardEnc = board.map(encodeCard)
  const deck = remainingDeck([h0, h1, ...boardEnc])

  const myHand: number[] = [h0, h1, ...boardEnc]
  const myVal = eval7(myHand)

  const oppHand = new Array<number>(7)
  oppHand[2] = boardEnc[0]; oppHand[3] = boardEnc[1]; oppHand[4] = boardEnc[2]
  oppHand[5] = boardEnc[3]; oppHand[6] = boardEnc[4]

  let wins = 0
  let total = 0
  const n = deck.length
  for (let i = 0; i < n - 1; i++) {
    for (let j = i + 1; j < n; j++) {
      oppHand[0] = deck[i]
      oppHand[1] = deck[j]
      const oppVal = eval7(oppHand)
      if (myVal < oppVal) wins += 2
      else if (myVal === oppVal) wins += 1
      total++
    }
  }
  return wins / (2 * total)
}

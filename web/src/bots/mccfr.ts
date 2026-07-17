import type { BotStrategy } from './types'
import type { GameState, PlayerAction, Action, Card, Street } from '../engines/types'
import { mcWinProb, riverWinProb } from '../engines/equity'
import { clampToValid } from './legality'

// Must match src/training/limit_poker.py MC_SAMPLES.
const MCCFR_ROLLOUTS = 100

// Number of equity buckets used to train the limit hold'em strategies.
const LIMIT_BUCKETS = 20

type StrategyTable = Record<string, { actions: string[]; probs: number[] }>

let kuhnStrategy: StrategyTable | null = null
let leducStrategy: StrategyTable | null = null
let limitMCCFR: StrategyTable | null = null
let limitMCCFRPlus: StrategyTable | null = null
let limitDCFR: StrategyTable | null = null
let preflopEquity: Record<string, number> | null = null

let loadPromise: Promise<void> | null = null

const RANK_VALUES: Record<string, number> = {
  '2': 0, '3': 1, '4': 2, '5': 3, '6': 4, '7': 5, '8': 6,
  '9': 7, 'T': 8, 'J': 9, 'Q': 10, 'K': 11, 'A': 12,
}

const RANK_LABELS = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A']

async function fetchModel<T>(name: string): Promise<T> {
  const base = import.meta.env.BASE_URL
  const r = await fetch(`${base}models/${name}`)
  if (!r.ok) {
    throw new Error(`mccfr: failed to load models/${name}: HTTP ${r.status} ${r.statusText}`)
  }
  return r.json() as Promise<T>
}

/** Optional models: log and continue so one missing file does not block the rest. */
async function fetchOptionalModel<T>(name: string): Promise<T | null> {
  try {
    return await fetchModel<T>(name)
  } catch (err) {
    console.warn(`mccfr: optional model models/${name} unavailable:`, err)
    return null
  }
}

export function loadStrategies(): Promise<void> {
  if (loadPromise) return loadPromise
  loadPromise = Promise.all([
    fetchModel<StrategyTable>('kuhn_strategy.json').then((d) => { kuhnStrategy = d }),
    fetchModel<StrategyTable>('leduc_strategy.json').then((d) => { leducStrategy = d }),
    fetchOptionalModel<StrategyTable>('MCCFR.json').then((d) => { if (d) limitMCCFR = d }),
    fetchOptionalModel<StrategyTable>('MCCFR_plus.json').then((d) => { if (d) limitMCCFRPlus = d }),
    fetchOptionalModel<StrategyTable>('DCFR.json').then((d) => { if (d) limitDCFR = d }),
    fetchModel<Record<string, number>>('preflop_equity.json').then((d) => { preflopEquity = d }),
  ]).then(() => undefined).catch((err) => {
    // Reset so a later call retries instead of caching the rejection forever.
    loadPromise = null
    throw err
  })
  return loadPromise
}

// Kick off loading at module import so strategies are usually ready before the
// first bot decision. A failure here is retried from ensureLoading().
loadStrategies().catch(() => {})

/** Fire-and-forget (re)load; used from decide() paths so a failed load retries. */
function ensureLoading(): void {
  loadStrategies().catch(() => {})
}

// ---- Info set key builders ----

export function kuhnInfoKey(state: GameState): string {
  const holeCard = state.players[state.currentPlayerIndex].holeCards[0].rank
  return `${holeCard}:${buildKuhnActionHistory(state)}`
}

export function leducInfoKey(state: GameState): string {
  const me = state.players[state.currentPlayerIndex]
  const holeCard = me.holeCards[0].rank
  const history = buildActionHistory(state, 'leduc')

  if (state.communityCards.length > 0) {
    const communityCard = state.communityCards[0].rank
    return `${holeCard}|${communityCard}:${history}`
  }
  return `${holeCard}:${history}`
}

export function limitInfoKey(state: GameState, nBuckets: number = LIMIT_BUCKETS): string {
  const me = state.players[state.currentPlayerIndex]
  const bucket = computeEquityBucket(me.holeCards, state.communityCards, state.street, nBuckets)
  const history = buildActionHistory(state, 'limit_holdem')
  return `b${bucket}:${history}`
}

function actionToLabel(actionType: string): string {
  switch (actionType) {
    case 'check': return 'P'
    case 'fold': return 'F'
    case 'call': return 'C'
    case 'bet': return 'B'
    case 'raise': return 'R'
    default: return 'P'
  }
}

// Limit hold'em trainer grammar (real-blinds heads-up game):
//   Preflop (SB acts first): fold->F, call->C (including the opening limp),
//   raise->R, and the BB checking their option->P (limp-check is "CP").
//   The engine surfaces the BB raising their option as a 'bet' (no bet to
//   call), but in the trainer grammar that is still a raise -> R.
//   Postflop (BB acts first): check->P, bet->B, call->C, raise->R, fold->F.
function limitActionToLabel(actionType: string, street: Street): string {
  if (street === 'preflop') {
    switch (actionType) {
      case 'fold': return 'F'
      case 'call': return 'C'
      case 'raise': return 'R'
      case 'bet': return 'R' // BB raising their own blind after an SB limp
      case 'check': return 'P' // BB checking the option
      default: return 'P'
    }
  }
  return actionToLabel(actionType)
}

function labelToAction(label: string, state: GameState): PlayerAction {
  const { betToCall, currentBetSize, validActions } = state
  switch (label) {
    case 'F':
      return { type: 'fold' }
    case 'C':
      return validActions.includes('call') ? { type: 'call', amount: betToCall } : { type: 'check' }
    case 'R':
    case 'B': {
      // The trainer's R/B distinction does not always match the engine's
      // bet/raise distinction (e.g. the BB option preflop); pick the legal one.
      const aggressive: Action = validActions.includes('raise') ? 'raise' : 'bet'
      return { type: aggressive, amount: currentBetSize }
    }
    case 'P':
      return validActions.includes('check') ? { type: 'check' } : { type: 'call', amount: betToCall }
    default:
      return { type: 'check' }
  }
}

const STREET_INDEX: Record<Street, number> = { preflop: 0, flop: 1, turn: 2, river: 3 }

// Builds the trainer-format action history, with '//' between streets. The
// Python trainer appends '//' as soon as a round completes, so keys at the
// start of a new street end in '//' even before any action on that street
// (e.g. "J|K:PP//"). We therefore emit a separator for every street boundary
// crossed up to and including the state's current street.
export function buildActionHistory(state: GameState, variant: string): string {
  let result = ''
  let streetIdx = 0

  for (const entry of state.actionHistory) {
    const entryIdx = STREET_INDEX[entry.street] ?? 0
    while (streetIdx < entryIdx) {
      result += '//'
      streetIdx++
    }
    result += variant === 'limit_holdem'
      ? limitActionToLabel(entry.action.type, entry.street)
      : actionToLabel(entry.action.type)
  }

  const currentIdx = STREET_INDEX[state.street] ?? 0
  while (streetIdx < currentIdx) {
    result += '//'
    streetIdx++
  }

  return result
}

function kuhnActionToLabel(actionType: string): string {
  switch (actionType) {
    case 'check': return 'P'
    case 'fold': return 'P'
    case 'bet': return 'B'
    case 'call': return 'B'
    default: return 'P'
  }
}

function kuhnLabelToAction(label: string, state: GameState): PlayerAction {
  const { betToCall } = state
  if (betToCall > 0) {
    return label === 'B'
      ? { type: 'call', amount: betToCall }
      : { type: 'fold' }
  }
  return label === 'B'
    ? { type: 'bet', amount: state.currentBetSize }
    : { type: 'check' }
}

function buildKuhnActionHistory(state: GameState): string {
  let result = ''
  for (const entry of state.actionHistory) {
    result += kuhnActionToLabel(entry.action.type)
  }
  return result
}

// ---- Equity computation for Limit Hold'em ----

function preflopKey(card0: Card, card1: Card): string {
  const r0 = RANK_VALUES[card0.rank]
  const r1 = RANK_VALUES[card1.rank]
  const high = Math.max(r0, r1)
  const low = Math.min(r0, r1)
  const highLabel = RANK_LABELS[high]
  const lowLabel = RANK_LABELS[low]

  if (high === low) {
    return `${highLabel}${lowLabel}`
  }
  const suited = card0.suit === card1.suit ? 's' : 'o'
  return `${highLabel}${lowLabel}${suited}`
}

function equityBucket(winProb: number, nBuckets: number): number {
  return Math.min(Math.floor(winProb * nBuckets), nBuckets - 1)
}

function computeEquityBucket(holeCards: Card[], communityCards: Card[], street: string, nBuckets: number): number {
  if (street === 'preflop' || communityCards.length === 0) {
    if (!preflopEquity || holeCards.length < 2) {
      throw new Error('mccfr: preflopEquity table not loaded yet')
    }
    const key = preflopKey(holeCards[0], holeCards[1])
    const equity = preflopEquity[key]
    if (equity === undefined) throw new Error(`mccfr: missing preflop equity for ${key}`)
    return equityBucket(equity, nBuckets)
  }

  const nBoard = communityCards.length
  let winProb: number
  if (nBoard === 3 || nBoard === 4) {
    winProb = mcWinProb(holeCards, communityCards, MCCFR_ROLLOUTS)
  } else if (nBoard === 5) {
    winProb = riverWinProb(holeCards, communityCards)
  } else {
    throw new Error(`mccfr: unexpected board size ${nBoard}`)
  }
  return equityBucket(winProb, nBuckets)
}

function sampleAction(probs: number[], actions: string[]): string {
  const roll = Math.random()
  let cumulative = 0
  for (let i = 0; i < probs.length; i++) {
    cumulative += probs[i]
    if (roll < cumulative) return actions[i]
  }
  return actions[actions.length - 1]
}

function randomFallback(state: GameState): PlayerAction {
  const { validActions, currentBetSize, betToCall } = state
  const action: Action = validActions[Math.floor(Math.random() * validActions.length)]
  switch (action) {
    case 'fold': return { type: 'fold' }
    case 'check': return { type: 'check' }
    case 'call': return { type: 'call', amount: betToCall }
    case 'bet': return { type: 'bet', amount: currentBetSize }
    case 'raise': return { type: 'raise', amount: currentBetSize }
  }
}

// ---- Strategy lookup ----

function lookupKuhn(state: GameState): { key: string; entry: { actions: string[]; probs: number[] } } | null {
  if (!kuhnStrategy) return null
  const key = kuhnInfoKey(state)
  const entry = kuhnStrategy[key]
  return entry ? { key, entry } : null
}

function lookupLeduc(state: GameState): { key: string; entry: { actions: string[]; probs: number[] } } | null {
  if (!leducStrategy) return null
  const key = leducInfoKey(state)
  const entry = leducStrategy[key]
  return entry ? { key, entry } : null
}

function lookupLimit(state: GameState, table: StrategyTable | null, nBuckets: number): { key: string; entry: { actions: string[]; probs: number[] } } | null {
  if (!table) return null
  try {
    const key = limitInfoKey(state, nBuckets)
    const entry = table[key]
    return entry ? { key, entry } : null
  } catch {
    return null
  }
}

// ---- Public lookup for the info-set probe UI ----

export interface StrategyProbe {
  key: string
  actions: string[]
  probs: number[]
}

function tableForBot(botName: string | undefined): StrategyTable | null {
  switch (botName) {
    case 'mccfr': return limitMCCFR
    case 'mccfr_plus': return limitMCCFRPlus
    case 'dcfr': return limitDCFR
    default: return null
  }
}

export function probeStrategy(state: GameState, playerIndex: number): StrategyProbe | null {
  const player = state.players[playerIndex]
  if (!player || player.holeCards.length === 0) return null
  const probeState: GameState = { ...state, currentPlayerIndex: playerIndex }
  const { variant } = state

  if (variant === 'kuhn') {
    const hit = lookupKuhn(probeState)
    return hit ? { key: hit.key, actions: hit.entry.actions, probs: hit.entry.probs } : null
  }

  if (variant === 'leduc') {
    const hit = lookupLeduc(probeState)
    return hit ? { key: hit.key, actions: hit.entry.actions, probs: hit.entry.probs } : null
  }

  if (variant === 'limit_holdem') {
    const table = tableForBot(player.botStrategy)
    if (!table) return null
    const hit = lookupLimit(probeState, table, LIMIT_BUCKETS)
    return hit ? { key: hit.key, actions: hit.entry.actions, probs: hit.entry.probs } : null
  }

  return null
}

// ---- Bot factories ----

function decideKuhn(state: GameState): PlayerAction {
  if (!kuhnStrategy) ensureLoading()
  const hit = lookupKuhn(state)
  if (!hit) return randomFallback(state)
  return kuhnLabelToAction(sampleAction(hit.entry.probs, hit.entry.actions), state)
}

function decideLeduc(state: GameState): PlayerAction {
  if (!leducStrategy) ensureLoading()
  const hit = lookupLeduc(state)
  if (!hit) return randomFallback(state)
  return labelToAction(sampleAction(hit.entry.probs, hit.entry.actions), state)
}

function decideLimit(state: GameState, table: StrategyTable | null): PlayerAction {
  if (!table) ensureLoading()
  const hit = lookupLimit(state, table, LIMIT_BUCKETS)
  if (!hit) return randomFallback(state)
  return labelToAction(sampleAction(hit.entry.probs, hit.entry.actions), state)
}

export const cfrBot: BotStrategy = {
  name: 'CFR',
  description: 'Pre-trained CFR strategy',
  decide(state: GameState): PlayerAction {
    if (state.variant === 'kuhn') return clampToValid(state, decideKuhn(state), 'cfr')
    if (state.variant === 'leduc') return clampToValid(state, decideLeduc(state), 'cfr')
    return clampToValid(state, randomFallback(state), 'cfr')
  },
}

export const mccfrBot: BotStrategy = {
  name: 'MCCFR',
  description: 'Pre-trained Monte Carlo CFR strategy',
  decide(state: GameState): PlayerAction {
    return clampToValid(state, decideLimit(state, limitMCCFR), 'mccfr')
  },
}

export const mccfrPlusBot: BotStrategy = {
  name: 'MCCFR+',
  description: 'Pre-trained MCCFR+ strategy',
  decide(state: GameState): PlayerAction {
    return clampToValid(state, decideLimit(state, limitMCCFRPlus), 'mccfr_plus')
  },
}

export const dcfrBot: BotStrategy = {
  name: 'DCFR',
  description: 'Pre-trained Discounted CFR strategy',
  decide(state: GameState): PlayerAction {
    return clampToValid(state, decideLimit(state, limitDCFR), 'dcfr')
  },
}

import type { Action, GameState, PlayerAction } from '../engines/types'

/** Fill in the correct amount for an action type from the current state. */
export function withAmount(type: Action, state: GameState): PlayerAction {
  switch (type) {
    case 'call': return { type, amount: state.betToCall }
    case 'bet': return { type, amount: state.currentBetSize }
    case 'raise': return { type, amount: state.currentBetSize }
    default: return { type }
  }
}

// Sensible substitutions when the desired action is not legal.
const SUBSTITUTES: Partial<Record<Action, Action>> = {
  check: 'call',
  call: 'check',
  bet: 'raise',
  raise: 'bet',
}

/**
 * Clamp a bot's chosen action to the engine's valid actions.
 * Mapping: check<->call, bet<->raise, otherwise the first valid action.
 * Warns on every clamp so misbehaving strategies are visible in the console.
 */
export function clampToValid(state: GameState, desired: PlayerAction, botName: string): PlayerAction {
  const valid = state.validActions
  if (valid.includes(desired.type)) {
    return withAmount(desired.type, state)
  }
  if (valid.length === 0) {
    // Hand is over; nothing to clamp to. The engine will reject this loudly.
    return desired
  }
  const sub = SUBSTITUTES[desired.type]
  const chosen: Action = sub !== undefined && valid.includes(sub) ? sub : valid[0]
  console.warn(
    `[bot:${botName}] clamped illegal action '${desired.type}' to '${chosen}'` +
    ` (valid: [${valid.join(', ')}], variant: ${state.variant}, street: ${state.street})`,
  )
  return withAmount(chosen, state)
}

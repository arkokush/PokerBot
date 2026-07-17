import type { BotStrategy } from './types'
import type { PlayerAction } from '../engines/types'
import { clampToValid } from './legality'

export const alwaysCallBot: BotStrategy = {
  name: 'Always Call',
  description: 'Never folds, never raises. Calls if there is a bet, checks otherwise.',

  decide(state): PlayerAction {
    const { validActions, betToCall } = state

    const desired: PlayerAction = validActions.includes('call')
      ? { type: 'call', amount: betToCall }
      : { type: 'check' }

    return clampToValid(state, desired, 'always_call')
  },
}

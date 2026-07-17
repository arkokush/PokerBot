import type { BotStrategy } from './types'
import type { Action, PlayerAction } from '../engines/types'
import { clampToValid, withAmount } from './legality'

export const randomBot: BotStrategy = {
  name: 'Random',
  description: 'Picks uniformly at random from valid actions',

  decide(state): PlayerAction {
    const { validActions } = state
    const action: Action = validActions[Math.floor(Math.random() * validActions.length)]
    return clampToValid(state, withAmount(action, state), 'random')
  },
}

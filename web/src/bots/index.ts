import { randomBot } from './random'
import { alwaysCallBot } from './always_call'
import { cfrBot, mccfrBot, mccfrPlusBot, dcfrBot } from './mccfr'
import type { BotStrategy } from './types'

export type { BotStrategy } from './types'

export const botStrategies: Record<string, BotStrategy> = {
  random: randomBot,
  always_call: alwaysCallBot,
  cfr: cfrBot,
  mccfr: mccfrBot,
  mccfr_plus: mccfrPlusBot,
  dcfr: dcfrBot,
}

export function getBot(name: string): BotStrategy {
  return botStrategies[name] ?? randomBot
}

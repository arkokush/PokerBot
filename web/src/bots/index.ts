import { randomBot } from './random'
import { alwaysCallBot } from './always_call'
import { mccfr8Bot, mccfr15Bot } from './mccfr'
import type { BotStrategy } from './types'

export type { BotStrategy } from './types'

export const botStrategies: Record<string, BotStrategy> = {
  random: randomBot,
  always_call: alwaysCallBot,
  mccfr_8: mccfr8Bot,
  mccfr_15: mccfr15Bot,
}

export function getBot(name: string): BotStrategy {
  return botStrategies[name] ?? randomBot
}

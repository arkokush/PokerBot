import { motion } from 'framer-motion'
import { Seat } from './Seat'
import { CardComponent } from '../ui/CardComponent'
import { ChipStack } from '../ui/ChipStack'
import { describeHand } from '../../engines/hand_eval'
import type { GameState, PlayMode, PlayerAction } from '../../engines/types'

interface Props {
  state: GameState
  lastActions: ({ action: PlayerAction } | null)[]
  mode: PlayMode
  pvpActivePlayer: number
}

const streetLabels: Record<string, string> = {
  preflop: 'Pre-flop',
  flop: 'Flop',
  turn: 'Turn',
  river: 'River',
}

export function PokerTable({ state, lastActions, mode, pvpActivePlayer }: Props) {
  const { players, communityCards, pot, currentPlayerIndex, winner, variant, street } = state

  const showStreetLabel = variant === 'limit_holdem' || variant === 'leduc'
  const maxCommunitySlots = variant === 'limit_holdem' ? 5 : variant === 'leduc' ? 1 : 0

  // Card visibility logic
  function shouldShowCards(playerIndex: number): boolean {
    const player = players[playerIndex]
    if (player.folded) return false
    if (state.isHandOver) return true
    if (player.isBot && mode !== 'bvb') return false
    if (mode === 'bvb') return true
    if (mode === 'pvb') return playerIndex === 0 // hero always sees own cards
    // PvP: only show the active player's cards
    if (mode === 'pvp') return playerIndex === pvpActivePlayer
    return false
  }

  function handDescription(playerIndex: number): string | null {
    if (variant === 'kuhn') return null
    const player = players[playerIndex]
    if (!player || player.holeCards.length === 0) return null
    if (!shouldShowCards(playerIndex)) return null
    return describeHand([...player.holeCards, ...communityCards]) || null
  }

  return (
    <div className="relative flex flex-col items-center justify-center h-full min-h-[480px]">
      {/* Felt background */}
      <div
        className="absolute inset-6 rounded-[50%] border-2 border-accent-purple/20"
        style={{
          background: 'radial-gradient(ellipse at center, var(--color-felt-deep) 0%, var(--color-felt-mid) 50%, var(--color-felt-edge) 100%)',
          boxShadow: '0 0 40px var(--color-accent-purple-glow), inset 0 0 60px rgba(0,0,0,0.3)',
        }}
      >
        {/* Noise texture overlay */}
        <div className="absolute inset-0 rounded-[50%] opacity-[0.03]" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`,
        }} />
      </div>

      {/* Table content */}
      <div className="relative z-10 flex flex-col items-center justify-between h-full w-full max-w-lg py-6">
        {/* Top player (player index 1) — pinned to top */}
        <div className="shrink-0">
          {players[1] && (
            <Seat
              player={players[1]}
              isActive={currentPlayerIndex === 1 && !state.isHandOver}
              isWinner={winner === 1}
              showCards={shouldShowCards(1)}
              position="top"
              lastAction={lastActions[1]}
              handDescription={handDescription(1)}
            />
          )}
        </div>

        {/* Community cards + pot — centered, fixed layout */}
        <div className="flex flex-col items-center justify-center shrink-0">
          {/* Street label — fixed height slot */}
          <div className="h-7 flex items-center justify-center">
            {showStreetLabel && (
              <motion.div
                key={street}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="px-3 py-0.5 rounded-full bg-bg-overlay/80 border border-border-subtle text-text-secondary text-xs font-medium"
              >
                {streetLabels[street] || street}
              </motion.div>
            )}
          </div>

          {/* Community cards — fixed height slot */}
          <div className="h-24 flex items-center justify-center">
            {maxCommunitySlots > 0 && (
              <div className="flex gap-2 justify-center">
                {communityCards.map((card, i) => (
                  <CardComponent key={`${card.rank}${card.suit}`} card={card} faceUp index={i} size="md" />
                ))}
                {Array.from({ length: maxCommunitySlots - communityCards.length }).map((_, i) => (
                  <div
                    key={`empty-${i}`}
                    className="w-14 h-20 rounded-lg border border-border-subtle/30 bg-white/5"
                  />
                ))}
              </div>
            )}
            {variant === 'kuhn' && (
              <div className="text-text-tertiary/20 font-display text-3xl font-bold uppercase tracking-wider select-none">
                KUHN
              </div>
            )}
          </div>

          {/* Pot — fixed height slot */}
          <div className="h-10 flex items-center justify-center">
            {pot > 0 && (
              <motion.div
                className="flex items-center gap-2"
                key={pot}
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.2 }}
              >
                <ChipStack amount={pot} color="purple" animate={false} />
              </motion.div>
            )}
          </div>
        </div>

        {/* Bottom player (player index 0) — pinned to bottom */}
        <div className="shrink-0">
          {players[0] && (
            <Seat
              player={players[0]}
              isActive={currentPlayerIndex === 0 && !state.isHandOver}
              isWinner={winner === 0}
              showCards={shouldShowCards(0)}
              position="bottom"
              lastAction={lastActions[0]}
              handDescription={handDescription(0)}
            />
          )}
        </div>
      </div>

      {/* Dealer button */}
      <motion.div
        className="absolute w-7 h-7 rounded-full bg-bg-overlay border-2 border-accent-purple/60 flex items-center justify-center text-xs font-bold text-accent-purple z-20"
        animate={{
          left: state.dealerIndex === 0 ? '35%' : '65%',
          top: state.dealerIndex === 0 ? '72%' : '28%',
        }}
        transition={{ duration: 0.6, ease: 'easeInOut' }}
      >
        D
      </motion.div>
    </div>
  )
}

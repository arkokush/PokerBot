import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useUIStore } from '../stores/uiStore'
import type { GameVariant, PlayMode } from '../engines/types'
import { Spade, Users, Bot, Eye, Sun, Moon, Brain } from 'lucide-react'

const variants: { id: GameVariant; name: string; description: string; cards: string }[] = [
  {
    id: 'kuhn',
    name: 'Kuhn Poker',
    description: '3-card deck, 1 card each, single betting round',
    cards: 'J Q K',
  },
  {
    id: 'leduc',
    name: 'Leduc Hold\'em',
    description: '6-card deck, 1 hole + 1 community, 2 rounds',
    cards: 'J Q K',
  },
  {
    id: 'limit_holdem',
    name: 'Limit Hold\'em',
    description: 'Full 52-card deck, 2 hole + 5 community, 4 rounds',
    cards: 'Full Deck',
  },
]

const modes: { id: PlayMode; name: string; icon: typeof Users; description: string }[] = [
  { id: 'pvp', name: 'PvP', icon: Users, description: 'Player vs Player' },
  { id: 'pvb', name: 'PvB', icon: Bot, description: 'Player vs Bot' },
  { id: 'bvb', name: 'BvB', icon: Eye, description: 'Bot vs Bot' },
]

export function Lobby() {
  const navigate = useNavigate()
  const { selectedVariant, selectedMode, setVariant, setMode, lightMode, toggleLightMode } = useUIStore()

  const canStart = selectedVariant && selectedMode

  return (
    <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden">
      {/* Top right controls */}
      <div className="absolute top-4 right-4 z-20 flex items-center gap-1">
        <button
          onClick={() => navigate('/what-is-cfr')}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg hover:bg-bg-elevated text-text-secondary hover:text-text-primary transition-colors cursor-pointer text-sm"
          title="Learn about CFR"
        >
          <Brain className="w-4 h-4" />
          <span>What is CFR?</span>
        </button>
        <button
          onClick={toggleLightMode}
          className="p-2 rounded-lg hover:bg-bg-elevated text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
          title={lightMode ? 'Switch to dark mode' : 'Switch to light mode'}
          aria-label={lightMode ? 'Switch to dark mode' : 'Switch to light mode'}
        >
          {lightMode ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
        </button>
      </div>

      {/* Animated gradient background */}
      <div
        className="absolute inset-0 opacity-30"
        style={{
          background: 'linear-gradient(135deg, #8B5CF6 0%, #0B0B12 40%, #22C55E 100%)',
          animation: 'gradientDrift 20s ease-in-out infinite alternate',
        }}
      />
      <style>{`
        @keyframes gradientDrift {
          0% { filter: hue-rotate(0deg); }
          100% { filter: hue-rotate(30deg); }
        }
      `}</style>

      <div className="relative z-10 flex flex-col items-center gap-12 px-6 max-w-5xl w-full">
        {/* Hero */}
        <motion.div
          className="text-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="flex items-center justify-center gap-3 mb-4">
            <Spade className="w-10 h-10 text-accent-purple" />
            <h1 className="font-display text-5xl font-bold tracking-tight text-text-primary">
              Poker, Meet <span className="text-accent-purple">T.I.M.</span>
            </h1>
          </div>
          <p className="text-text-secondary text-lg">
            The MCCFR Trained Intelligence Model built to win.
          </p>
        </motion.div>

        {/* Variant Selection */}
        <motion.div
          className="w-full"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15 }}
        >
          <p className="text-text-tertiary text-xs uppercase tracking-[0.18em] mb-4 text-center">
            Choose Variant
          </p>
          <div className="grid grid-cols-3 gap-4">
            {variants.map((v) => {
              const selected = selectedVariant === v.id
              return (
                <motion.button
                  key={v.id}
                  onClick={() => setVariant(v.id)}
                  whileHover={{ y: -4 }}
                  className={`relative p-6 rounded-xl text-left transition-all cursor-pointer ${
                    selected
                      ? 'bg-bg-elevated border-2 border-accent-purple shadow-[0_0_24px_var(--color-accent-purple-glow)]'
                      : 'bg-bg-elevated border border-border-subtle hover:border-border-strong'
                  }`}
                  style={{
                    boxShadow: selected ? undefined : 'inset 0 1px 0 rgba(255,255,255,0.03)',
                  }}
                >
                  {selected && (
                    <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-accent-purple flex items-center justify-center">
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                  )}
                  <div className="font-mono text-text-tertiary text-sm mb-3">{v.cards}</div>
                  <h3 className="font-display text-xl font-semibold text-text-primary mb-1">
                    {v.name}
                  </h3>
                  <p className="text-text-secondary text-sm">{v.description}</p>
                </motion.button>
              )
            })}
          </div>
        </motion.div>

        {/* Mode Selection */}
        <motion.div
          className="w-full"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
        >
          <p className="text-text-tertiary text-xs uppercase tracking-[0.18em] mb-4 text-center">
            Play Mode
          </p>
          <div className="flex justify-center gap-2 p-1 bg-bg-elevated rounded-xl border border-border-subtle w-fit mx-auto">
            {modes.map((m) => {
              const selected = selectedMode === m.id
              const Icon = m.icon
              return (
                <button
                  key={m.id}
                  onClick={() => setMode(m.id)}
                  className={`flex items-center gap-2 px-6 py-3 rounded-lg transition-all cursor-pointer text-sm font-medium ${
                    selected
                      ? 'bg-accent-purple text-white shadow-[0_0_16px_var(--color-accent-purple-glow)]'
                      : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{m.name}</span>
                  <span className="hidden sm:inline text-xs opacity-70">{m.description}</span>
                </button>
              )
            })}
          </div>
        </motion.div>

        {/* Start Button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.45 }}
        >
          <motion.button
            onClick={() => canStart && navigate('/setup')}
            disabled={!canStart}
            whileHover={canStart ? { scale: 1.03 } : undefined}
            whileTap={canStart ? { scale: 0.98 } : undefined}
            className={`px-12 py-4 rounded-xl font-display text-lg font-semibold transition-all ${
              canStart
                ? 'bg-accent-purple text-white shadow-[0_0_32px_var(--color-accent-purple-glow)] hover:shadow-[0_0_48px_var(--color-accent-purple-glow)] cursor-pointer'
                : 'bg-bg-elevated text-text-tertiary opacity-50 cursor-not-allowed'
            }`}
          >
            Start Match
          </motion.button>
        </motion.div>
      </div>
    </div>
  )
}

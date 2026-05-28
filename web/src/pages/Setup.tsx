import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useUIStore } from '../stores/uiStore'
import { useGameStore } from '../stores/gameStore'
import { ArrowLeft, User, Bot, Sun, Moon } from 'lucide-react'
import type { GameConfig, Player } from '../engines/types'

const variantDefaults: Record<string, { smallBlind: number; bigBlind: number; startingStack: number }> = {
  kuhn: { smallBlind: 1, bigBlind: 1, startingStack: 10 },
  leduc: { smallBlind: 1, bigBlind: 1, startingStack: 20 },
  limit_holdem: { smallBlind: 1, bigBlind: 2, startingStack: 100 },
}

const botOptions = [
  { value: 'random', label: 'Random', desc: 'Picks actions uniformly at random' },
  { value: 'always_call', label: 'Always Call', desc: 'Never folds, never raises' },
  { value: 'mccfr_8', label: 'MCCFR-8', desc: 'Pre-trained Monte Carlo CFR strategy (8 buckets)' },
  { value: 'mccfr_15', label: 'MCCFR-15', desc: 'Pre-trained Monte Carlo CFR strategy (15 buckets)' },
]

export function Setup() {
  const navigate = useNavigate()
  const { selectedVariant, selectedMode, lightMode, toggleLightMode } = useUIStore()
  const startSession = useGameStore((s) => s.startSession)

  const defaults = variantDefaults[selectedVariant || 'kuhn']

  const [player1Name, setPlayer1Name] = useState('Player 1')
  const [player2Name, setPlayer2Name] = useState('Player 2')
  const [bot1Strategy, setBot1Strategy] = useState('random')
  const [bot2Strategy, setBot2Strategy] = useState('always_call')
  const [handLimit, setHandLimit] = useState(100)
  const [startingStack, setStartingStack] = useState(defaults.startingStack)
  const [smallBlind, setSmallBlind] = useState(defaults.smallBlind)
  const [bigBlind, setBigBlind] = useState(defaults.bigBlind)
  const [seed, setSeed] = useState('')
  const [infiniteStack, setInfiniteStack] = useState(false)

  if (!selectedVariant || !selectedMode) {
    navigate('/')
    return null
  }

  const isBot1 = selectedMode === 'bvb'
  const isBot2 = selectedMode === 'pvb' || selectedMode === 'bvb'

  const variantLabel = selectedVariant === 'kuhn' ? 'Kuhn Poker' : selectedVariant === 'leduc' ? 'Leduc Hold\'em' : 'Limit Hold\'em'
  const modeLabel = selectedMode === 'pvp' ? 'Player vs Player' : selectedMode === 'pvb' ? 'Player vs Bot' : 'Bot vs Bot'

  const handleStart = () => {
    const config: GameConfig = {
      variant: selectedVariant,
      startingStack,
      smallBlind,
      bigBlind,
      handLimit,
      seed: seed ? parseInt(seed, 10) : undefined,
      infiniteStack,
    }

    const players: Pick<Player, 'id' | 'name' | 'isBot' | 'botStrategy'>[] = [
      { id: 0, name: isBot1 ? `Bot (${botOptions.find(b => b.value === bot1Strategy)?.label})` : player1Name, isBot: isBot1, botStrategy: isBot1 ? bot1Strategy : undefined },
      { id: 1, name: isBot2 ? `Bot (${botOptions.find(b => b.value === bot2Strategy)?.label})` : player2Name, isBot: isBot2, botStrategy: isBot2 ? bot2Strategy : undefined },
    ]

    startSession(config, selectedMode, players)
    const session = useGameStore.getState().session
    if (session) {
      navigate(`/play/${session.id}`)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center py-12 px-6 relative">
      {/* Light mode toggle */}
      <button
        onClick={toggleLightMode}
        className="absolute top-4 right-4 z-20 p-2 rounded-lg hover:bg-bg-elevated text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
        title={lightMode ? 'Switch to dark mode' : 'Switch to light mode'}
      >
        {lightMode ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
      </button>

      <div className="w-full max-w-2xl">
        {/* Header */}
        <motion.div
          className="flex items-center gap-4 mb-10"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <button
            onClick={() => navigate('/')}
            className="p-2 rounded-lg hover:bg-bg-elevated transition-colors text-text-secondary hover:text-text-primary cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="font-display text-2xl font-bold text-text-primary">Match Setup</h1>
            <p className="text-text-secondary text-sm">{variantLabel} &middot; {modeLabel}</p>
          </div>
        </motion.div>

        {/* Seat Config */}
        <motion.div
          className="grid grid-cols-2 gap-4 mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          {/* Seat 1 */}
          <div className="p-5 rounded-xl bg-bg-elevated border border-border-subtle" style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)' }}>
            <div className="flex items-center gap-2 mb-4">
              {isBot1 ? <Bot className="w-4 h-4 text-text-tertiary" /> : <User className="w-4 h-4 text-accent-purple" />}
              <span className={`text-xs uppercase tracking-[0.18em] font-medium ${isBot1 ? 'text-text-tertiary' : 'text-accent-purple'}`}>
                {isBot1 ? 'BOT' : 'PLAYER'}
              </span>
            </div>
            {isBot1 ? (
              <div>
                <label className="text-text-secondary text-sm block mb-2">Strategy</label>
                <select
                  value={bot1Strategy}
                  onChange={(e) => setBot1Strategy(e.target.value)}
                  className="w-full bg-bg-overlay border border-border-subtle rounded-lg px-3 py-2 text-text-primary text-sm focus:outline-none focus:border-accent-purple"
                >
                  {botOptions.map((b) => (
                    <option key={b.value} value={b.value}>{b.label}</option>
                  ))}
                </select>
                <p className="text-text-tertiary text-xs mt-1">{botOptions.find((b) => b.value === bot1Strategy)?.desc}</p>
              </div>
            ) : (
              <div>
                <label className="text-text-secondary text-sm block mb-2">Name</label>
                <input
                  value={player1Name}
                  onChange={(e) => setPlayer1Name(e.target.value)}
                  className="w-full bg-bg-overlay border border-border-subtle rounded-lg px-3 py-2 text-text-primary text-sm focus:outline-none focus:border-accent-purple"
                />
              </div>
            )}
          </div>

          {/* Seat 2 */}
          <div className="p-5 rounded-xl bg-bg-elevated border border-border-subtle" style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)' }}>
            <div className="flex items-center gap-2 mb-4">
              {isBot2 ? <Bot className="w-4 h-4 text-text-tertiary" /> : <User className="w-4 h-4 text-accent-purple" />}
              <span className={`text-xs uppercase tracking-[0.18em] font-medium ${isBot2 ? 'text-text-tertiary' : 'text-accent-purple'}`}>
                {isBot2 ? 'BOT' : 'PLAYER'}
              </span>
            </div>
            {isBot2 ? (
              <div>
                <label className="text-text-secondary text-sm block mb-2">Strategy</label>
                <select
                  value={bot2Strategy}
                  onChange={(e) => setBot2Strategy(e.target.value)}
                  className="w-full bg-bg-overlay border border-border-subtle rounded-lg px-3 py-2 text-text-primary text-sm focus:outline-none focus:border-accent-purple"
                >
                  {botOptions.map((b) => (
                    <option key={b.value} value={b.value}>{b.label}</option>
                  ))}
                </select>
                <p className="text-text-tertiary text-xs mt-1">{botOptions.find((b) => b.value === bot2Strategy)?.desc}</p>
              </div>
            ) : (
              <div>
                <label className="text-text-secondary text-sm block mb-2">Name</label>
                <input
                  value={player2Name}
                  onChange={(e) => setPlayer2Name(e.target.value)}
                  className="w-full bg-bg-overlay border border-border-subtle rounded-lg px-3 py-2 text-text-primary text-sm focus:outline-none focus:border-accent-purple"
                />
              </div>
            )}
          </div>
        </motion.div>

        {/* Match Options */}
        <motion.div
          className="p-5 rounded-xl bg-bg-elevated border border-border-subtle mb-8"
          style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)' }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <p className="text-text-tertiary text-xs uppercase tracking-[0.18em] font-medium mb-4">Match Options</p>
          <div className="grid grid-cols-4 gap-4">
            <div>
              <label className="text-text-secondary text-sm block mb-2">Hands</label>
              <select
                value={handLimit}
                onChange={(e) => setHandLimit(Number(e.target.value))}
                className="w-full bg-bg-overlay border border-border-subtle rounded-lg px-3 py-2 text-text-primary text-sm focus:outline-none focus:border-accent-purple"
              >
                <option value={10}>10</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={500}>500</option>
                <option value={1000}>1000</option>
                <option value={999999}>Unlimited</option>
              </select>
            </div>
            <div>
              <label className="text-text-secondary text-sm block mb-2">Stack</label>
              <input
                type="number"
                value={startingStack}
                onChange={(e) => setStartingStack(Number(e.target.value))}
                disabled={infiniteStack}
                className={`w-full bg-bg-overlay border border-border-subtle rounded-lg px-3 py-2 text-text-primary text-sm focus:outline-none focus:border-accent-purple ${infiniteStack ? 'opacity-40' : ''}`}
              />
              <label className="flex items-center gap-2 mt-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={infiniteStack}
                  onChange={(e) => setInfiniteStack(e.target.checked)}
                  className="accent-accent-purple w-3.5 h-3.5 cursor-pointer"
                />
                <span className="text-text-secondary text-xs">Infinite stack</span>
              </label>
            </div>
            <div>
              <label className="text-text-secondary text-sm block mb-2">Blinds</label>
              <div className="flex gap-1">
                <input
                  type="number"
                  value={smallBlind}
                  onChange={(e) => setSmallBlind(Number(e.target.value))}
                  className="w-1/2 bg-bg-overlay border border-border-subtle rounded-lg px-2 py-2 text-text-primary text-sm focus:outline-none focus:border-accent-purple"
                  placeholder="SB"
                />
                <input
                  type="number"
                  value={bigBlind}
                  onChange={(e) => setBigBlind(Number(e.target.value))}
                  className="w-1/2 bg-bg-overlay border border-border-subtle rounded-lg px-2 py-2 text-text-primary text-sm focus:outline-none focus:border-accent-purple"
                  placeholder="BB"
                />
              </div>
            </div>
            <div>
              <label className="text-text-secondary text-sm block mb-2">Seed</label>
              <input
                type="text"
                value={seed}
                onChange={(e) => setSeed(e.target.value)}
                placeholder="Optional"
                className="w-full bg-bg-overlay border border-border-subtle rounded-lg px-3 py-2 text-text-primary text-sm focus:outline-none focus:border-accent-purple placeholder:text-text-tertiary"
              />
            </div>
          </div>
        </motion.div>

        {/* Begin Button */}
        <motion.div
          className="flex justify-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <motion.button
            onClick={handleStart}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.98 }}
            className="px-16 py-4 rounded-xl bg-accent-purple text-white font-display text-lg font-semibold shadow-[0_0_32px_var(--color-accent-purple-glow)] hover:shadow-[0_0_48px_var(--color-accent-purple-glow)] transition-shadow cursor-pointer"
          >
            Begin
          </motion.button>
        </motion.div>
      </div>
    </div>
  )
}

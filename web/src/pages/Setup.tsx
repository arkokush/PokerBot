import { useEffect, useState } from 'react'
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

const KUHN_LEDUC_BOTS = [
  { value: 'random', label: 'Random', desc: 'Picks actions uniformly at random' },
  { value: 'always_call', label: 'Always Call', desc: 'Never folds, never raises' },
  { value: 'cfr', label: 'CFR', desc: 'Pre-trained CFR strategy' },
]

const LIMIT_HOLDEM_BOTS = [
  { value: 'random', label: 'Random', desc: 'Picks actions uniformly at random' },
  { value: 'always_call', label: 'Always Call', desc: 'Never folds, never raises' },
  { value: 'mccfr', label: 'MCCFR', desc: 'Pre-trained Monte Carlo CFR strategy' },
  { value: 'mccfr_plus', label: 'MCCFR+', desc: 'Pre-trained MCCFR+ strategy' },
  { value: 'dcfr', label: 'DCFR', desc: 'Pre-trained Discounted CFR strategy' },
]

function botOptionsForVariant(variant: string | null) {
  return variant === 'limit_holdem' ? LIMIT_HOLDEM_BOTS : KUHN_LEDUC_BOTS
}

export function Setup() {
  const navigate = useNavigate()
  const { selectedVariant, selectedMode, lightMode, toggleLightMode } = useUIStore()
  const startSession = useGameStore((s) => s.startSession)

  const defaults = variantDefaults[selectedVariant || 'kuhn']

  const [player1Name, setPlayer1Name] = useState('Player 1')
  const [player2Name, setPlayer2Name] = useState('Player 2')
  const botOptions = botOptionsForVariant(selectedVariant)
  const [bot1Strategy, setBot1Strategy] = useState(botOptions[0].value)
  const [bot2Strategy, setBot2Strategy] = useState(botOptions[1].value)
  const [handLimit, setHandLimit] = useState(100)
  const [startingStack, setStartingStack] = useState(defaults.startingStack)
  const [smallBlind, setSmallBlind] = useState(defaults.smallBlind)
  const [bigBlind, setBigBlind] = useState(defaults.bigBlind)
  const [seed, setSeed] = useState('')
  const [infiniteStack, setInfiniteStack] = useState(false)

  // Redirect to lobby when arriving without a variant/mode selection
  useEffect(() => {
    if (!selectedVariant || !selectedMode) {
      navigate('/')
    }
  }, [selectedVariant, selectedMode, navigate])

  if (!selectedVariant || !selectedMode) {
    return null
  }

  const isBot1 = selectedMode === 'bvb'
  const isBot2 = selectedMode === 'pvb' || selectedMode === 'bvb'

  const variantLabel = selectedVariant === 'kuhn' ? 'Kuhn Poker' : selectedVariant === 'leduc' ? 'Leduc Hold\'em' : 'Limit Hold\'em'
  const modeLabel = selectedMode === 'pvp' ? 'Player vs Player' : selectedMode === 'pvb' ? 'Player vs Bot' : 'Bot vs Bot'

  // Kuhn/Leduc engines hardcode antes/bet sizes — blinds are not configurable there
  const blindsConfigurable = selectedVariant === 'limit_holdem'
  const effectiveSmallBlind = blindsConfigurable ? smallBlind : defaults.smallBlind
  const effectiveBigBlind = blindsConfigurable ? bigBlind : defaults.bigBlind

  // Seed: empty is fine (unseeded); anything else must be a whole number
  const seedTrimmed = seed.trim()
  const seedIsValid = seedTrimmed === '' || /^-?\d+$/.test(seedTrimmed)

  // Validate numeric options (Number('') coerces to 0, so guard minimums here)
  const minStack = effectiveBigBlind * 10
  const blindError = blindsConfigurable
    ? smallBlind < 1
      ? 'Small blind must be at least 1'
      : bigBlind < 1
        ? 'Big blind must be at least 1'
        : smallBlind > bigBlind
          ? 'Small blind cannot exceed big blind'
          : null
    : null
  const stackError = startingStack < minStack
    ? `Starting stack must be at least ${minStack} (10× big blind)`
    : null
  const configError = blindError ?? stackError
  const canStart = !configError

  const handleStart = () => {
    if (configError) return
    const config: GameConfig = {
      variant: selectedVariant,
      startingStack,
      smallBlind: effectiveSmallBlind,
      bigBlind: effectiveBigBlind,
      handLimit,
      seed: seedIsValid && seedTrimmed !== '' ? parseInt(seedTrimmed, 10) : undefined,
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
        aria-label={lightMode ? 'Switch to dark mode' : 'Switch to light mode'}
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
            aria-label="Back to lobby"
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
              <label className="text-text-secondary text-sm block mb-2">
                Blinds{!blindsConfigurable && <span className="text-text-tertiary"> (fixed)</span>}
              </label>
              <div className="flex gap-1">
                <input
                  type="number"
                  min={1}
                  value={blindsConfigurable ? smallBlind : defaults.smallBlind}
                  onChange={(e) => setSmallBlind(Number(e.target.value))}
                  disabled={!blindsConfigurable}
                  aria-label="Small blind"
                  className={`w-1/2 bg-bg-overlay border border-border-subtle rounded-lg px-2 py-2 text-text-primary text-sm focus:outline-none focus:border-accent-purple ${!blindsConfigurable ? 'opacity-40' : ''}`}
                  placeholder="SB"
                />
                <input
                  type="number"
                  min={1}
                  value={blindsConfigurable ? bigBlind : defaults.bigBlind}
                  onChange={(e) => setBigBlind(Number(e.target.value))}
                  disabled={!blindsConfigurable}
                  aria-label="Big blind"
                  className={`w-1/2 bg-bg-overlay border border-border-subtle rounded-lg px-2 py-2 text-text-primary text-sm focus:outline-none focus:border-accent-purple ${!blindsConfigurable ? 'opacity-40' : ''}`}
                  placeholder="BB"
                />
              </div>
              {!blindsConfigurable && (
                <p className="text-text-tertiary text-xs mt-1">
                  {variantLabel} uses fixed antes/bet sizes
                </p>
              )}
            </div>
            <div>
              <label className="text-text-secondary text-sm block mb-2">Seed</label>
              <input
                type="text"
                value={seed}
                onChange={(e) => setSeed(e.target.value)}
                placeholder="Optional"
                className={`w-full bg-bg-overlay border rounded-lg px-3 py-2 text-text-primary text-sm focus:outline-none placeholder:text-text-tertiary ${seedIsValid ? 'border-border-subtle focus:border-accent-purple' : 'border-accent-red focus:border-accent-red'}`}
              />
              {!seedIsValid && (
                <p className="text-accent-red text-xs mt-1">
                  Seed must be a whole number — will be ignored
                </p>
              )}
            </div>
          </div>
        </motion.div>

        {/* Begin Button */}
        <motion.div
          className="flex flex-col items-center gap-3"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          {configError && (
            <p className="text-accent-red text-sm">{configError}</p>
          )}
          <motion.button
            onClick={handleStart}
            disabled={!canStart}
            whileHover={canStart ? { scale: 1.03 } : undefined}
            whileTap={canStart ? { scale: 0.98 } : undefined}
            className={`px-16 py-4 rounded-xl font-display text-lg font-semibold transition-shadow ${
              canStart
                ? 'bg-accent-purple text-white shadow-[0_0_32px_var(--color-accent-purple-glow)] hover:shadow-[0_0_48px_var(--color-accent-purple-glow)] cursor-pointer'
                : 'bg-bg-elevated text-text-tertiary opacity-50 cursor-not-allowed'
            }`}
          >
            Begin
          </motion.button>
        </motion.div>
      </div>
    </div>
  )
}

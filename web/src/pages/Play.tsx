import { useEffect, useCallback, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '../stores/gameStore'
import { useUIStore } from '../stores/uiStore'
import { PokerTable } from '../components/table/PokerTable'
import { ActionBar } from '../components/table/ActionBar'
import { BvBController } from '../components/table/BvBController'
import { LeftPane } from '../components/table/LeftPane'
import { RightPane } from '../components/table/RightPane'
import { Volume2, VolumeX, LogOut, Sun, Moon } from 'lucide-react'
import type { PlayerAction } from '../engines/types'

export function Play() {
  const navigate = useNavigate()
  useParams()
  const session = useGameStore((s) => s.session)
  const { dealHand, playerAction, botAct, stepOneAction, stepOneHand, toggleRunning, setBvbSpeed, endSession } = useGameStore()
  const {
    soundEnabled, toggleSound, lightMode, toggleLightMode,
    pvpWaitingForPass, setPvpWaitingForPass, pvpActivePlayer, setPvpActivePlayer,
  } = useUIStore()
  const bvbTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Track last actions for animation labels
  const [lastActions, setLastActions] = useState<({ action: PlayerAction } | null)[]>([null, null])
  const prevActionCountRef = useRef(0)

  // Redirect if no session
  useEffect(() => {
    if (!session) {
      navigate('/')
    } else if (session.state && !session.state.isHandOver && session.state.handNumber === 0) {
      dealHand()
    }
  }, [session, navigate, dealHand])

  // Track action changes to show labels + trigger PvP pass
  useEffect(() => {
    if (!session?.state) return
    const { actionHistory } = session.state
    if (actionHistory.length > prevActionCountRef.current && actionHistory.length > 0) {
      const latest = actionHistory[actionHistory.length - 1]
      setLastActions((prev) => {
        const next = [...prev] as ({ action: PlayerAction } | null)[]
        next[latest.playerIndex] = { action: latest.action }
        return next
      })
      setTimeout(() => {
        setLastActions([null, null])
      }, 1500)

      // PvP: after a human acts, show pass-device screen before next player's turn
      if (session.mode === 'pvp' && !session.state.isHandOver) {
        const nextPlayer = session.state.players[session.state.currentPlayerIndex]
        if (!nextPlayer.isBot && !nextPlayer.folded) {
          setPvpWaitingForPass(true)
        }
      }
    }
    prevActionCountRef.current = actionHistory.length
  }, [session?.state?.actionHistory.length])

  // Sync pvpActivePlayer with current player index
  useEffect(() => {
    if (!session?.state || session.mode !== 'pvp') return
    if (!pvpWaitingForPass) {
      setPvpActivePlayer(session.state.currentPlayerIndex)
    }
  }, [session?.state?.currentPlayerIndex, pvpWaitingForPass, session?.mode])

  // PvP: when a new hand is dealt, set up pass for player 0
  useEffect(() => {
    if (!session?.state || session.mode !== 'pvp') return
    if (session.state.handNumber > 0 && session.state.actionHistory.length === 0) {
      // New hand just dealt — show pass screen so first player can see their cards
      setPvpWaitingForPass(true)
      setPvpActivePlayer(session.state.currentPlayerIndex)
    }
  }, [session?.state?.handNumber, session?.state?.actionHistory.length, session?.mode])

  // Auto-act for bots in PvB mode
  // Depend on actionHistory length + street so we re-fire even if currentPlayerIndex doesn't change across streets
  useEffect(() => {
    if (!session?.state || session.state.isHandOver) return
    if (session.mode === 'pvb' || session.mode === 'pvp') {
      const currentPlayer = session.state.players[session.state.currentPlayerIndex]
      if (currentPlayer.isBot) {
        const timer = setTimeout(() => botAct(), 600)
        return () => clearTimeout(timer)
      }
    }
  }, [session?.state?.currentPlayerIndex, session?.state?.isHandOver, session?.state?.actionHistory.length, session?.state?.street, session?.mode, botAct])

  // Auto-deal next hand after a pause
  useEffect(() => {
    if (!session?.state || !session.state.isHandOver) return
    if (session.mode === 'pvp' || session.mode === 'pvb') {
      const handNum = session.state.handNumber
      const bankrupt = !session.config.infiniteStack && session.state.players.some((p) => p.stack <= 0)
      if (handNum < session.config.handLimit && !bankrupt) {
        const timer = setTimeout(() => dealHand(), 2500)
        return () => clearTimeout(timer)
      }
    }
  }, [session?.state?.isHandOver, session?.mode, dealHand])

  // BvB auto-play loop
  useEffect(() => {
    if (!session || session.mode !== 'bvb') return

    if (session.isRunning && session.bvbSpeed > 0) {
      const interval = Math.round(800 / session.bvbSpeed)
      bvbTimerRef.current = setInterval(() => {
        const s = useGameStore.getState().session
        if (!s || !s.state) return
        const bankrupt = !s.config.infiniteStack && s.state.players.some((p) => p.stack <= 0)
        if (s.state.handNumber >= s.config.handLimit || (bankrupt && s.state.isHandOver)) {
          toggleRunning()
          return
        }
        if (s.state.isHandOver) {
          useGameStore.getState().dealHand()
        } else {
          useGameStore.getState().botAct()
        }
      }, interval)
      return () => {
        if (bvbTimerRef.current) clearInterval(bvbTimerRef.current)
      }
    } else if (session.isRunning && session.bvbSpeed === 0) {
      const runBatch = () => {
        const batchSize = 50
        for (let i = 0; i < batchSize; i++) {
          useGameStore.getState().stepOneHand()
          const s = useGameStore.getState().session
          if (!s) return
          const bankrupt = !s.config.infiniteStack && s.state!.players.some((p) => p.stack <= 0)
          if (s.state!.handNumber >= s.config.handLimit || bankrupt) {
            toggleRunning()
            return
          }
        }
        requestAnimationFrame(runBatch)
      }
      requestAnimationFrame(runBatch)
    }
  }, [session?.isRunning, session?.bvbSpeed, session?.mode])

  // Keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!session?.state || session.state.isHandOver) return
      if (pvpWaitingForPass) return // block input while passing device
      const currentPlayer = session.state.players[session.state.currentPlayerIndex]
      if (currentPlayer.isBot) return

      const { validActions } = session.state
      switch (e.key.toLowerCase()) {
        case 'f':
          if (validActions.includes('fold')) playerAction({ type: 'fold' })
          break
        case 'c':
          if (validActions.includes('check')) playerAction({ type: 'check' })
          else if (validActions.includes('call')) playerAction({ type: 'call', amount: session.state.betToCall })
          break
        case 'r':
          if (validActions.includes('bet')) playerAction({ type: 'bet', amount: session.state.currentBetSize })
          else if (validActions.includes('raise')) playerAction({ type: 'raise', amount: session.state.currentBetSize })
          break
      }
    },
    [session?.state, playerAction, pvpWaitingForPass],
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  const handlePvpReady = () => {
    setPvpWaitingForPass(false)
    if (session?.state) {
      setPvpActivePlayer(session.state.currentPlayerIndex)
    }
  }

  if (!session?.state) return null

  const state = session.state
  const variantLabel = session.config.variant === 'kuhn' ? 'Kuhn' : session.config.variant === 'leduc' ? 'Leduc' : 'Limit HE'
  const modeLabel = session.mode.toUpperCase()
  const isBankrupt = !session.config.infiniteStack && state.players.some((p) => p.stack <= 0)
  const isMatchOver = state.isHandOver && (state.handNumber >= session.config.handLimit || isBankrupt)
  const currentPlayerName = state.players[state.currentPlayerIndex]?.name ?? 'Player'

  return (
    <div className="h-screen flex flex-col bg-bg-base">
      {/* Top Bar */}
      <div className="h-12 flex items-center justify-between px-4 border-b border-border-subtle bg-bg-elevated shrink-0">
        <div className="flex items-center gap-3">
          <span className="px-2 py-0.5 rounded bg-accent-purple/20 text-accent-purple text-xs font-bold uppercase tracking-wider">
            {variantLabel}
          </span>
          <span className="text-text-secondary text-sm font-mono">
            Hand #{state.handNumber}
          </span>
          <span className="text-text-tertiary text-xs">{modeLabel}</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={toggleLightMode}
            className="p-2 rounded-lg hover:bg-bg-overlay text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
            title={lightMode ? 'Switch to dark mode' : 'Switch to light mode'}
          >
            {lightMode ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
          </button>
          <button
            onClick={toggleSound}
            className="p-2 rounded-lg hover:bg-bg-overlay text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>
          <button
            onClick={() => {
              endSession()
              navigate('/')
            }}
            className="p-2 rounded-lg hover:bg-bg-overlay text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main layout */}
      <div className="flex flex-1 min-h-0">
        {/* Left Pane */}
        <LeftPane
          players={state.players}
          handHistory={session.handHistory}
          config={session.config}
          state={state}
          mode={session.mode}
          pvpActivePlayer={pvpActivePlayer}
        />

        {/* Center */}
        <div className="flex-1 flex flex-col min-h-0 relative">
          <div className="flex-1 min-h-0">
            <PokerTable
              state={state}
              lastActions={lastActions}
              mode={session.mode}
              pvpActivePlayer={pvpActivePlayer}
            />
          </div>

          {/* PvP device-passing overlay */}
          <AnimatePresence>
            {pvpWaitingForPass && session.mode === 'pvp' && !state.isHandOver && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="absolute inset-0 z-30 flex items-center justify-center"
                style={{ background: 'var(--color-surface-glass)', backdropFilter: 'blur(20px) saturate(140%)' }}
              >
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.9, opacity: 0 }}
                  className="text-center p-8 rounded-2xl bg-bg-elevated border border-border-subtle shadow-xl max-w-sm"
                  style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03), 0 16px 48px rgba(0,0,0,0.4)' }}
                >
                  <p className="text-text-tertiary text-xs uppercase tracking-[0.18em] font-medium mb-3">
                    Pass the device
                  </p>
                  <p className="text-text-primary font-display text-xl font-bold mb-1">
                    {currentPlayerName}'s Turn
                  </p>
                  <p className="text-text-secondary text-sm mb-6">
                    Hand the device to {currentPlayerName}, then tap Ready.
                  </p>
                  <button
                    onClick={handlePvpReady}
                    className="px-10 py-3 rounded-xl bg-accent-purple text-white font-display font-semibold cursor-pointer hover:shadow-[0_0_24px_var(--color-accent-purple-glow)] transition-shadow text-base"
                  >
                    I'm Ready
                  </button>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Match Over Banner */}
          {isMatchOver && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center py-4"
            >
              <p className="font-display text-xl font-bold text-text-primary mb-2">Match Complete</p>
              <div className="flex justify-center gap-4">
                <button
                  onClick={() => navigate(`/review/${session.id}`)}
                  className="px-6 py-2 rounded-xl bg-accent-purple text-white font-medium text-sm cursor-pointer hover:shadow-[0_0_16px_var(--color-accent-purple-glow)] transition-shadow"
                >
                  Review
                </button>
                <button
                  onClick={() => { endSession(); navigate('/') }}
                  className="px-6 py-2 rounded-xl bg-bg-elevated border border-border-subtle text-text-primary font-medium text-sm cursor-pointer hover:border-border-strong transition-colors"
                >
                  New Match
                </button>
              </div>
            </motion.div>
          )}

          {/* Action Bar or BvB Controller */}
          {!isMatchOver && !pvpWaitingForPass && (
            <div className="shrink-0">
              {session.mode === 'bvb' ? (
                <BvBController
                  isRunning={session.isRunning}
                  speed={session.bvbSpeed}
                  handNumber={state.handNumber}
                  handLimit={session.config.handLimit}
                  onToggleRunning={toggleRunning}
                  onStepAction={stepOneAction}
                  onStepHand={stepOneHand}
                  onSetSpeed={setBvbSpeed}
                />
              ) : (
                <ActionBar state={state} onAction={playerAction} />
              )}
            </div>
          )}
        </div>

        {/* Right Pane */}
        <RightPane handHistory={session.handHistory} players={state.players} config={session.config} />
      </div>
    </div>
  )
}

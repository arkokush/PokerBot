import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '../stores/gameStore'
import { useUIStore } from '../stores/uiStore'
import { PokerTable } from '../components/table/PokerTable'
import { ActionBar } from '../components/table/ActionBar'
import { BvBController } from '../components/table/BvBController'
import { LeftPane } from '../components/table/LeftPane'
import { RightPane } from '../components/table/RightPane'
import { LogOut, Sun, Moon } from 'lucide-react'
import type { PlayerAction } from '../engines/types'

export function Play() {
  const navigate = useNavigate()
  const { sessionId } = useParams()
  const session = useGameStore((s) => s.session)
  const { dealHand, playerAction, botAct, stepOneAction, stepOneHand, toggleRunning, setBvbSpeed, endSession } = useGameStore()
  const {
    lightMode, toggleLightMode,
    pvpWaitingForPass, setPvpWaitingForPass, pvpActivePlayer, setPvpActivePlayer,
  } = useUIStore()

  // Track last actions for animation labels (one clear-timer per seat)
  const [lastActions, setLastActions] = useState<({ action: PlayerAction } | null)[]>([null, null])
  const prevActionCountRef = useRef(0)
  const labelTimersRef = useRef<(ReturnType<typeof setTimeout> | null)[]>([null, null])

  // Defensively clear any stale PvP pass overlay left over from a quit session
  useEffect(() => {
    setPvpWaitingForPass(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Redirect if no session or URL doesn't match the live session; deal hand 1 otherwise
  useEffect(() => {
    if (!session || session.id !== sessionId) {
      navigate('/')
    } else if (session.state && !session.state.isHandOver && session.state.handNumber === 0) {
      dealHand()
    }
  }, [session, sessionId, navigate, dealHand])

  // Track action changes to show labels + trigger PvP pass
  useEffect(() => {
    if (!session?.state) return
    const { actionHistory } = session.state
    if (actionHistory.length > prevActionCountRef.current && actionHistory.length > 0) {
      const latest = actionHistory[actionHistory.length - 1]
      const seat = latest.playerIndex
      setLastActions((prev) => {
        const next = [...prev] as ({ action: PlayerAction } | null)[]
        next[seat] = { action: latest.action }
        return next
      })
      // Reset only this seat's clear-timer so a quick action on the other
      // seat doesn't wipe both labels early
      const prevTimer = labelTimersRef.current[seat]
      if (prevTimer) clearTimeout(prevTimer)
      labelTimersRef.current[seat] = setTimeout(() => {
        labelTimersRef.current[seat] = null
        setLastActions((prev) => {
          const next = [...prev] as ({ action: PlayerAction } | null)[]
          next[seat] = null
          return next
        })
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

  // Clear pending label timers on unmount
  useEffect(() => {
    // The array identity is stable (entries are mutated in place), so capturing
    // it here is safe for the cleanup closure.
    const timers = labelTimersRef.current
    return () => {
      timers.forEach((t) => {
        if (t) clearTimeout(t)
      })
    }
  }, [])

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
    if (!session || session.mode !== 'bvb' || !session.isRunning) return

    // Returns true when the match is over and the run loop should stop.
    // Only stops between hands (isHandOver) so the final hand always completes,
    // matching the isMatchOver definition used for the "Match Complete" banner.
    // Uses stopRunning (not toggleRunning) so concurrent loops (e.g. StrictMode)
    // can't flip the state back to running.
    const stopIfMatchOver = (): boolean => {
      const s = useGameStore.getState().session
      if (!s || !s.state || !s.isRunning) return true
      const bankrupt = !s.config.infiniteStack && s.state.players.some((p) => p.stack <= 0)
      if (s.state.isHandOver && (s.state.handNumber >= s.config.handLimit || bankrupt)) {
        useGameStore.getState().stopRunning()
        return true
      }
      return false
    }

    if (session.bvbSpeed > 0) {
      const interval = Math.round(800 / session.bvbSpeed)
      const timer = setInterval(() => {
        const s = useGameStore.getState().session
        if (!s || !s.state || !s.isRunning) return
        if (stopIfMatchOver()) return
        if (s.state.isHandOver) {
          useGameStore.getState().dealHand()
        } else {
          useGameStore.getState().botAct()
        }
      }, interval)
      return () => clearInterval(timer)
    }

    // Instant (speed 0): batched rAF loop with proper cancellation
    let cancelled = false
    let rafId = 0
    const runBatch = () => {
      if (cancelled) return
      const batchSize = 50
      for (let i = 0; i < batchSize; i++) {
        // Re-check pause/end every step so Pause takes effect immediately
        if (cancelled || stopIfMatchOver()) return
        useGameStore.getState().stepOneHand()
      }
      rafId = requestAnimationFrame(runBatch)
    }
    rafId = requestAnimationFrame(runBatch)
    return () => {
      cancelled = true
      cancelAnimationFrame(rafId)
    }
  }, [session?.isRunning, session?.bvbSpeed, session?.mode])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const state = session?.state
      if (!state || state.isHandOver) return
      if (pvpWaitingForPass) return // block input while passing device
      const currentPlayer = state.players[state.currentPlayerIndex]
      if (currentPlayer.isBot) return

      const { validActions } = state
      switch (e.key.toLowerCase()) {
        case 'f':
          if (validActions.includes('fold')) playerAction({ type: 'fold' })
          break
        case 'c':
          if (validActions.includes('check')) playerAction({ type: 'check' })
          else if (validActions.includes('call')) playerAction({ type: 'call', amount: state.betToCall })
          break
        case 'r':
          if (validActions.includes('bet')) playerAction({ type: 'bet', amount: state.currentBetSize })
          else if (validActions.includes('raise')) playerAction({ type: 'raise', amount: state.currentBetSize })
          break
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [session, playerAction, pvpWaitingForPass])

  const handlePvpReady = () => {
    setPvpWaitingForPass(false)
    if (session?.state) {
      setPvpActivePlayer(session.state.currentPlayerIndex)
    }
  }

  if (!session?.state || session.id !== sessionId) return null

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
            aria-label={lightMode ? 'Switch to dark mode' : 'Switch to light mode'}
          >
            {lightMode ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
          </button>
          <button
            onClick={() => {
              endSession()
              navigate('/')
            }}
            className="p-2 rounded-lg hover:bg-bg-overlay text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
            title="Quit match"
            aria-label="Quit match"
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

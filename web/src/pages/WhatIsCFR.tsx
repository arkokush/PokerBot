import { useState, useMemo, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Brain, TrendingDown, TrendingUp, Scissors, Layers, GitBranch, SlidersHorizontal } from 'lucide-react'

// Rock-Paper-Scissors payoff matrix from P1's perspective.
// PAYOFF[p1_action][p2_action]
const RPS_PAYOFF = [
  [ 0, -1,  1],  // Rock:     tie vs R, lose vs P, win vs S
  [ 1,  0, -1],  // Paper:    win vs R, tie vs P, lose vs S
  [-1,  1,  0],  // Scissors: lose vs R, win vs P, tie vs S
]

const RPS_ACTIONS = [
  { name: 'Rock',     color: '#EF4444' },
  { name: 'Paper',    color: '#8B5CF6' },
  { name: 'Scissors', color: '#22C55E' },
]

const RPS_EMOJI = ['✊', '✋', '✌️'] as const

function sample(probs: number[]): number {
  const r = Math.random()
  let cum = 0
  for (let i = 0; i < probs.length; i++) {
    cum += probs[i]
    if (r < cum) return i
  }
  return probs.length - 1
}

function strategyFromRegret(regret: number[]): number[] {
  const pos = regret.map((r) => Math.max(0, r))
  const sum = pos.reduce((a, b) => a + b, 0)
  if (sum === 0) return pos.map(() => 1 / pos.length)
  return pos.map((p) => p / sum)
}

function Section({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.5, delay }}
      className="w-full max-w-3xl mx-auto"
    >
      {children}
    </motion.section>
  )
}

function RegretBar({ label, value, color, max }: { label: string; value: number; color: string; max: number }) {
  const width = Math.min(50, (Math.abs(value) / max) * 50)
  const isNeg = value < 0
  return (
    <div className="flex items-center gap-3">
      <div className="w-12 text-text-secondary text-sm font-mono text-right">{label}</div>
      <div className="flex-1 h-7 bg-bg-elevated rounded relative overflow-hidden border border-border-subtle">
        <div className="absolute inset-y-0 left-1/2 w-px bg-border-strong" />
        <motion.div
          animate={{ width: `${width}%` }}
          transition={{ type: 'spring', stiffness: 200, damping: 20 }}
          className="absolute top-0 bottom-0 rounded-sm"
          style={{
            backgroundColor: color,
            opacity: 0.85,
            left: isNeg ? 'auto' : '50%',
            right: isNeg ? '50%' : 'auto',
          }}
        />
      </div>
      <div className="w-16 text-right text-text-primary text-sm font-mono tabular-nums">
        {value >= 0 ? '+' : ''}{value.toFixed(2)}
      </div>
    </div>
  )
}

function StrategyBar({ label, prob, color }: { label: string; prob: number; color: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-12 text-text-secondary text-sm font-mono text-right">{label}</div>
      <div className="flex-1 h-7 bg-bg-elevated rounded overflow-hidden border border-border-subtle">
        <motion.div
          animate={{ width: `${prob * 100}%` }}
          transition={{ type: 'spring', stiffness: 200, damping: 20 }}
          className="h-full rounded-sm"
          style={{ backgroundColor: color, opacity: 0.85 }}
        />
      </div>
      <div className="w-16 text-right text-text-primary text-sm font-mono tabular-nums">
        {(prob * 100).toFixed(1)}%
      </div>
    </div>
  )
}

function ThrowDisplay({
  phase,
  label,
  choice,
  shakeIdx,
}: {
  phase: 'idle' | 'shaking' | 'thrown' | 'updating'
  label: string
  choice: number
  shakeIdx: number
}) {
  const isRevealed = phase === 'thrown' || phase === 'updating'
  return (
    <div className="flex flex-col items-center gap-2 min-w-[100px]">
      <span className="text-text-tertiary text-xs uppercase tracking-wider">{label}</span>
      <motion.div
        className="text-5xl select-none"
        animate={
          phase === 'shaking'
            ? { y: [0, -14, 0] }
            : isRevealed
              ? { scale: [1.15, 1] }
              : {}
        }
        transition={
          phase === 'shaking'
            ? { duration: 0.28, repeat: Infinity, ease: 'easeInOut' }
            : { duration: 0.25 }
        }
      >
        {phase === 'shaking' ? RPS_EMOJI[shakeIdx] : isRevealed ? RPS_EMOJI[choice] : '✊'}
      </motion.div>
      {isRevealed && (
        <motion.span
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-sm font-medium"
          style={{ color: RPS_ACTIONS[choice].color }}
        >
          {RPS_ACTIONS[choice].name}
        </motion.span>
      )}
    </div>
  )
}

function RegretDemo() {
  const [regretP1, setRegretP1] = useState<number[]>([0, 0, 0])
  const [regretP2, setRegretP2] = useState<number[]>([0, 0, 0])
  const [iter, setIter] = useState(0)
  const [stratSumP1, setStratSumP1] = useState<number[]>([0, 0, 0])

  const [phase, setPhase] = useState<'idle' | 'shaking' | 'thrown' | 'updating'>('idle')
  const [updateStep, setUpdateStep] = useState(-1)
  const [p1, setP1] = useState(0)
  const [p2, setP2] = useState(0)
  const [shakeIdx, setShakeIdx] = useState(0)
  const [autoPlay, setAutoPlay] = useState(false)
  const [history, setHistory] = useState<Array<{ p1: number; p2: number; payoff: number }>>([])

  const p1Ref = useRef(0)
  const p2Ref = useRef(0)
  const regretP1Ref = useRef(regretP1)
  const regretP2Ref = useRef(regretP2)

  useEffect(() => {
    regretP1Ref.current = regretP1
    regretP2Ref.current = regretP2
  }, [regretP1, regretP2])

  const strategyP1 = useMemo(() => strategyFromRegret(regretP1), [regretP1])
  const avgStrategyP1 = useMemo(() => normalize(stratSumP1), [stratSumP1])
  const maxRegret = Math.max(2, ...regretP1.map(Math.abs))

  const payoff = RPS_PAYOFF[p1][p2]
  const cfValues = [0, 1, 2].map((a) => RPS_PAYOFF[a][p2])
  const deltas = cfValues.map((cf) => cf - payoff)

  useEffect(() => {
    if (phase !== 'shaking') return
    const id = setInterval(() => setShakeIdx((i) => (i + 1) % 3), 80)
    return () => clearInterval(id)
  }, [phase])

  useEffect(() => {
    if (phase === 'idle') return undefined
    let timeout: ReturnType<typeof setTimeout> | undefined

    if (phase === 'shaking') {
      timeout = setTimeout(() => setPhase('thrown'), 900)
    } else if (phase === 'thrown') {
      timeout = setTimeout(() => {
        setUpdateStep(0)
        setPhase('updating')
      }, 1000)
    } else if (phase === 'updating') {
      if (updateStep < 2) {
        timeout = setTimeout(() => setUpdateStep((s) => s + 1), 550)
      } else {
        timeout = setTimeout(() => {
          const p1v = p1Ref.current
          const p2v = p2Ref.current
          const pf = RPS_PAYOFF[p1v][p2v]
          const ds = [0, 1, 2].map((a) => RPS_PAYOFF[a][p2v] - pf)
          const stratBefore = strategyFromRegret(regretP1Ref.current)
          setStratSumP1((prev) => prev.map((s, i) => s + stratBefore[i]))
          setRegretP1((prev) => prev.map((r, i) => r + ds[i]))
          const p2pf = -pf
          const ds2 = [0, 1, 2].map((a) => -RPS_PAYOFF[p1v][a] - p2pf)
          setRegretP2((prev) => prev.map((r, i) => r + ds2[i]))
          setIter((prev) => prev + 1)
          setHistory((prev) => [...prev.slice(-29), { p1: p1v, p2: p2v, payoff: pf }])
          setUpdateStep(-1)
          setPhase('idle')
        }, 650)
      }
    }

    return () => { if (timeout) clearTimeout(timeout) }
  }, [phase, updateStep])

  function startRound() {
    if (phase !== 'idle') return
    const sP1 = strategyFromRegret(regretP1Ref.current)
    const sP2 = strategyFromRegret(regretP2Ref.current)
    const chosenP1 = sample(sP1)
    const chosenP2 = sample(sP2)
    setP1(chosenP1)
    setP2(chosenP2)
    p1Ref.current = chosenP1
    p2Ref.current = chosenP2
    setPhase('shaking')
  }

  function reset() {
    setRegretP1([0, 0, 0])
    setRegretP2([0, 0, 0])
    setStratSumP1([0, 0, 0])
    setIter(0)
    setPhase('idle')
    setHistory([])
    setAutoPlay(false)
    setUpdateStep(-1)
  }

  useEffect(() => {
    if (!autoPlay || phase !== 'idle') return
    const id = setTimeout(startRound, 350)
    return () => clearTimeout(id)
  }, [autoPlay, phase])

  const outcomeLabel = payoff === 1 ? 'WIN' : payoff === -1 ? 'LOSE' : 'TIE'
  const outcomeColor = payoff === 1 ? '#22C55E' : payoff === -1 ? '#EF4444' : '#A1A1B5'
  const isRevealed = phase === 'thrown' || phase === 'updating'

  return (
    <div className="p-6 rounded-xl bg-bg-elevated border border-border-subtle">
      <div className="flex items-baseline justify-between mb-4 flex-wrap gap-2">
        <p className="text-text-secondary text-sm">
          <span className="text-text-primary font-medium">Rock-Paper-Scissors CFR.</span>{' '}
          Both players sample actions, then update regret. Win = +1, lose = −1, tie = 0.
        </p>
        <p className="text-text-tertiary text-xs font-mono">round {iter}</p>
      </div>

      {/* Throw arena */}
      <div className="flex items-center justify-center gap-6 sm:gap-10 py-6 mb-5 rounded-lg bg-bg-overlay border border-border-subtle">
        <ThrowDisplay phase={phase} label="P1 (CFR)" choice={p1} shakeIdx={shakeIdx} />

        <div className="flex flex-col items-center gap-1 min-w-[72px]">
          {isRevealed ? (
            <motion.div
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="flex flex-col items-center"
            >
              <span className="text-xl font-display font-bold" style={{ color: outcomeColor }}>
                {outcomeLabel}
              </span>
              <span className="font-mono text-sm" style={{ color: outcomeColor }}>
                {payoff >= 0 ? '+' : ''}{payoff}
              </span>
            </motion.div>
          ) : phase === 'shaking' ? (
            <motion.span
              animate={{ opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 0.6, repeat: Infinity }}
              className="text-text-tertiary text-sm font-display"
            >
              ...
            </motion.span>
          ) : (
            <span className="text-text-tertiary text-lg font-display">vs</span>
          )}
        </div>

        <ThrowDisplay phase={phase} label="P2 (CFR)" choice={p2} shakeIdx={(shakeIdx + 1) % 3} />
      </div>

      {/* Regret update breakdown */}
      <AnimatePresence>
        {phase === 'updating' && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-5 p-4 rounded-lg bg-bg-base border border-border-subtle overflow-hidden"
          >
            <p className="text-text-tertiary text-xs uppercase tracking-wider mb-3">
              Regret update — what if P1 played differently?
            </p>
            <p className="text-text-secondary text-xs mb-3">
              P1 played{' '}
              <span className="font-medium" style={{ color: RPS_ACTIONS[p1].color }}>
                {RPS_ACTIONS[p1].name}
              </span>{' '}
              against{' '}
              <span className="font-medium" style={{ color: RPS_ACTIONS[p2].color }}>
                {RPS_ACTIONS[p2].name}
              </span>{' '}
              → payoff{' '}
              <span className="font-mono font-medium" style={{ color: outcomeColor }}>
                {payoff >= 0 ? '+' : ''}{payoff}
              </span>
            </p>
            <div className="space-y-1.5">
              {[0, 1, 2].map((a) => {
                const visible = a <= updateStep
                const cf = cfValues[a]
                const delta = deltas[a]
                const isChosen = a === p1
                return (
                  <motion.div
                    key={a}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: visible ? 1 : 0.2, x: visible ? 0 : -10 }}
                    transition={{ duration: 0.3 }}
                    className={`flex items-center gap-2 sm:gap-3 py-1.5 px-3 rounded text-sm ${
                      visible && a === updateStep ? 'bg-bg-overlay' : ''
                    }`}
                  >
                    <span className="text-base">{RPS_EMOJI[a]}</span>
                    <span className="w-14 text-text-secondary text-xs">{RPS_ACTIONS[a].name}</span>
                    {visible && (
                      <>
                        <span className="text-text-tertiary text-xs">would get</span>
                        <span
                          className="font-mono text-xs w-6 text-center"
                          style={{ color: cf > 0 ? '#22C55E' : cf < 0 ? '#EF4444' : '#A1A1B5' }}
                        >
                          {cf >= 0 ? '+' : ''}{cf}
                        </span>
                        <span className="text-text-tertiary text-xs">→ regret</span>
                        <motion.span
                          initial={{ scale: 1.4 }}
                          animate={{ scale: 1 }}
                          className="font-mono text-sm font-semibold min-w-[2.5rem] text-center"
                          style={{ color: delta > 0 ? '#22C55E' : delta < 0 ? '#EF4444' : '#A1A1B5' }}
                        >
                          {delta >= 0 ? '+' : ''}{delta}
                        </motion.span>
                        {isChosen && (
                          <span className="text-[10px] text-text-tertiary bg-bg-overlay px-1.5 py-0.5 rounded">
                            played
                          </span>
                        )}
                      </>
                    )}
                  </motion.div>
                )
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Accumulated regret bars */}
      <div className="space-y-2 mb-5">
        <p className="text-text-tertiary text-xs uppercase tracking-wider mb-2">P1 accumulated regret</p>
        {RPS_ACTIONS.map((a, i) => (
          <RegretBar key={a.name} label={a.name} value={regretP1[i]} color={a.color} max={maxRegret} />
        ))}
      </div>

      {/* Current + Average strategy */}
      <div className="grid md:grid-cols-2 gap-5 mb-5">
        <div className="space-y-2">
          <p className="text-text-tertiary text-xs uppercase tracking-wider mb-2">
            P1 current strategy <span className="normal-case text-text-tertiary/70">(from regret matching)</span>
          </p>
          {RPS_ACTIONS.map((a, i) => (
            <StrategyBar key={a.name} label={a.name} prob={strategyP1[i]} color={a.color} />
          ))}
        </div>
        <div className="space-y-2">
          <p className="text-text-tertiary text-xs uppercase tracking-wider mb-2">
            P1 average strategy <span className="normal-case text-text-tertiary/70">(running mean)</span>
          </p>
          {RPS_ACTIONS.map((a, i) => (
            <StrategyBar key={a.name} label={a.name} prob={avgStrategyP1[i]} color={a.color} />
          ))}
        </div>
      </div>

      {/* Controls */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={startRound}
          disabled={phase !== 'idle'}
          className="px-4 py-2 rounded-lg bg-accent-purple text-white text-sm font-medium cursor-pointer hover:shadow-[0_0_16px_var(--color-accent-purple-glow)] transition-shadow disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {phase !== 'idle' ? 'Playing...' : 'Play Round'}
        </button>
        <button
          onClick={() => setAutoPlay((a) => !a)}
          className={`px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors ${
            autoPlay
              ? 'bg-accent-red text-white hover:bg-accent-red/80'
              : 'bg-accent-purple/60 text-white hover:bg-accent-purple/80'
          }`}
        >
          {autoPlay ? 'Stop' : 'Auto Play'}
        </button>
        <button
          onClick={reset}
          className="px-4 py-2 rounded-lg bg-bg-overlay text-text-secondary text-sm font-medium border border-border-subtle cursor-pointer hover:text-text-primary transition-colors"
        >
          Reset
        </button>
      </div>

      {/* Round history */}
      {history.length > 0 && (
        <div className="mt-4 flex gap-1 flex-wrap">
          {history.map((h, i) => (
            <div
              key={i}
              className="w-7 h-7 rounded flex items-center justify-center text-xs cursor-default"
              style={{
                backgroundColor:
                  h.payoff === 1
                    ? 'rgba(34,197,94,0.15)'
                    : h.payoff === -1
                      ? 'rgba(239,68,68,0.15)'
                      : 'rgba(161,161,181,0.08)',
              }}
              title={`${RPS_ACTIONS[h.p1].name} vs ${RPS_ACTIONS[h.p2].name}: ${h.payoff >= 0 ? '+' : ''}${h.payoff}`}
            >
              <span style={{ fontSize: '14px' }}>{RPS_EMOJI[h.p1]}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function DiscountVisual() {
  const iters = [1, 10, 50, 100, 200, 500]
  function discount(alpha: number, t: number) {
    if (!isFinite(alpha)) return 1
    return Math.pow(t, alpha) / (Math.pow(t, alpha) + 1)
  }
  const rows = [
    { label: 'α = ∞ (no discount)', alpha: Infinity, color: '#64748B' },
    { label: 'α = 1.5 (DCFR)',      alpha: 1.5,      color: '#22C55E' },
    { label: 'α = 1   (LCFR)',      alpha: 1,        color: '#8B5CF6' },
    { label: 'α = 0   (immediate)', alpha: 0,        color: '#EF4444' },
  ]

  // SVG layout: per iteration, draw 4 bars side by side.
  const W = 640
  const H = 180
  const padLeft = 36
  const padRight = 12
  const padTop = 12
  const padBottom = 28
  const plotH = H - padTop - padBottom
  const plotW = W - padLeft - padRight
  const groupW = plotW / iters.length
  const barW = (groupW - 8) / rows.length

  return (
    <div className="p-5 rounded-xl bg-bg-elevated border border-border-subtle">
      <p className="text-text-tertiary text-xs uppercase tracking-wider mb-3">
        Discount factor applied to old regret at iteration t
      </p>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
        {/* axes */}
        <line x1={padLeft} y1={padTop} x2={padLeft} y2={padTop + plotH} stroke="rgba(255,255,255,0.12)" />
        <line x1={padLeft} y1={padTop + plotH} x2={padLeft + plotW} y2={padTop + plotH} stroke="rgba(255,255,255,0.12)" />
        {/* y axis ticks */}
        {[0, 0.5, 1].map((y) => (
          <g key={y}>
            <line
              x1={padLeft - 3}
              y1={padTop + plotH - y * plotH}
              x2={padLeft + plotW}
              y2={padTop + plotH - y * plotH}
              stroke="rgba(255,255,255,0.06)"
              strokeDasharray={y === 0 ? undefined : '2 3'}
            />
            <text
              x={padLeft - 6}
              y={padTop + plotH - y * plotH + 3}
              fill="#5C5C70"
              fontSize="10"
              textAnchor="end"
              fontFamily="monospace"
            >
              {y.toFixed(1)}
            </text>
          </g>
        ))}
        {/* bar groups */}
        {iters.map((t, gi) => {
          const groupX = padLeft + gi * groupW + 4
          return (
            <g key={t}>
              {rows.map((r, ri) => {
                const v = discount(r.alpha, t)
                const h = v * plotH
                const x = groupX + ri * barW
                const y = padTop + plotH - h
                return (
                  <rect
                    key={r.label}
                    x={x}
                    y={y}
                    width={Math.max(1, barW - 1)}
                    height={h}
                    fill={r.color}
                    opacity={0.85}
                    rx={1.5}
                  >
                    <title>{`${r.label} @ t=${t}: ${v.toFixed(3)}`}</title>
                  </rect>
                )
              })}
              <text
                x={groupX + (barW * rows.length) / 2}
                y={padTop + plotH + 16}
                fill="#5C5C70"
                fontSize="11"
                textAnchor="middle"
                fontFamily="monospace"
              >
                t={t}
              </text>
            </g>
          )
        })}
      </svg>
      <div className="grid grid-cols-2 gap-2 mt-3">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center gap-2">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: r.color }} />
            <span className="text-text-secondary text-xs font-mono">{r.label}</span>
          </div>
        ))}
      </div>
      <p className="text-text-tertiary text-xs mt-3">
        Higher bar = more of the old regret is kept. α = ∞ keeps everything; α = 0 halves each iteration.
      </p>
    </div>
  )
}

// Kuhn poker Nash equilibrium (alpha = 1/3 family — one of the equilibria).
// Format: { infoSetKey: { pass: prob, bet: prob } }
const KUHN_NASH: Record<string, { pass: number; bet: number }> = {
  'J:':   { pass: 2 / 3, bet: 1 / 3 },   // bluff
  'J:P':  { pass: 1,     bet: 0 },
  'J:B':  { pass: 1,     bet: 0 },        // fold
  'J:PB': { pass: 1,     bet: 0 },        // fold
  'Q:':   { pass: 1,     bet: 0 },
  'Q:P':  { pass: 1,     bet: 0 },
  'Q:B':  { pass: 2 / 3, bet: 1 / 3 },   // mixed call
  'Q:PB': { pass: 2 / 3, bet: 1 / 3 },
  'K:':   { pass: 0,     bet: 1 },        // always value-bet
  'K:P':  { pass: 0,     bet: 1 },
  'K:B':  { pass: 0,     bet: 1 },        // always call
  'K:PB': { pass: 0,     bet: 1 },
}

interface TreeNode {
  id: string
  kind: 'info' | 'terminal'
  label: string
  infoSetKey?: string
  payoff?: string
  x: number
  y: number
}

interface TreeEdge {
  from: string
  to: string
  action: 'P' | 'B'
}

// Build the Kuhn game subtree from one chance outcome: P1 holds K.
// P2's card varies, but the info-set structure is shown from P1's view + P2 placeholder info sets.
function buildKuhnSubtree(card: 'J' | 'Q' | 'K'): { nodes: TreeNode[]; edges: TreeEdge[] } {
  // Hardcoded coordinates for a clean 5-level tree.
  const nodes: TreeNode[] = [
    { id: 'p1-root',  kind: 'info',     label: `P1 (${card})`, infoSetKey: `${card}:`,  x: 50, y: 6 },
    { id: 'p2-after-p', kind: 'info',   label: 'P2',          infoSetKey: `?:P`,      x: 22, y: 30 },
    { id: 'p2-after-b', kind: 'info',   label: 'P2',          infoSetKey: `?:B`,      x: 78, y: 30 },
    { id: 'show-pp',  kind: 'terminal', label: 'showdown',    payoff: '±1',           x: 8,  y: 56 },
    { id: 'p1-after-pb', kind: 'info',  label: `P1 (${card})`, infoSetKey: `${card}:PB`, x: 36, y: 56 },
    { id: 'p1-folded',kind: 'terminal', label: 'P2 wins',     payoff: '−1',           x: 64, y: 56 },
    { id: 'show-bc',  kind: 'terminal', label: 'showdown',    payoff: '±2',           x: 92, y: 56 },
    { id: 'fold-pbp', kind: 'terminal', label: 'P1 folds',    payoff: '−1',           x: 26, y: 82 },
    { id: 'show-pbb', kind: 'terminal', label: 'showdown',    payoff: '±2',           x: 46, y: 82 },
  ]
  const edges: TreeEdge[] = [
    { from: 'p1-root',     to: 'p2-after-p',  action: 'P' },
    { from: 'p1-root',     to: 'p2-after-b',  action: 'B' },
    { from: 'p2-after-p',  to: 'show-pp',     action: 'P' },
    { from: 'p2-after-p',  to: 'p1-after-pb', action: 'B' },
    { from: 'p2-after-b',  to: 'p1-folded',   action: 'P' },
    { from: 'p2-after-b',  to: 'show-bc',     action: 'B' },
    { from: 'p1-after-pb', to: 'fold-pbp',    action: 'P' },
    { from: 'p1-after-pb', to: 'show-pbb',    action: 'B' },
  ]
  return { nodes, edges }
}

function KuhnTree() {
  const [card, setCard] = useState<'J' | 'Q' | 'K'>('K')
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const { nodes, edges } = useMemo(() => buildKuhnSubtree(card), [card])
  const W = 760
  const H = 440
  const padX = 40
  const padY = 30

  function xy(n: TreeNode) {
    return { x: padX + (n.x / 100) * (W - 2 * padX), y: padY + (n.y / 100) * (H - 2 * padY) }
  }

  const nodeMap = new Map(nodes.map((n) => [n.id, n]))
  const hoveredNode = hoveredId ? nodes.find((n) => n.id === hoveredId) : null
  const hoveredStrategy = hoveredNode?.infoSetKey ? KUHN_NASH[hoveredNode.infoSetKey] ?? null : null

  return (
    <div className="p-5 rounded-xl bg-bg-elevated border border-border-subtle">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <p className="text-text-tertiary text-xs uppercase tracking-wider">
          Kuhn poker subtree — P1 holds <span className="text-text-primary font-mono">{card}</span>
        </p>
        <div className="flex gap-1">
          {(['J', 'Q', 'K'] as const).map((c) => (
            <button
              key={c}
              onClick={() => setCard(c)}
              className={`px-3 py-1 rounded-md text-xs font-mono cursor-pointer transition-colors ${
                card === c
                  ? 'bg-accent-purple text-white'
                  : 'bg-bg-overlay text-text-secondary hover:text-text-primary'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-4 flex-wrap">
        <div className="flex-1 min-w-[480px]">
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
            {/* edges */}
            {edges.map((e) => {
              const from = xy(nodeMap.get(e.from)!)
              const to = xy(nodeMap.get(e.to)!)
              const midX = (from.x + to.x) / 2
              const midY = (from.y + to.y) / 2
              const color = e.action === 'B' ? '#8B5CF6' : '#22C55E'
              return (
                <g key={`${e.from}-${e.to}`}>
                  <line
                    x1={from.x}
                    y1={from.y + 14}
                    x2={to.x}
                    y2={to.y - 14}
                    stroke={color}
                    strokeWidth="1.6"
                    opacity="0.55"
                  />
                  <text
                    x={midX}
                    y={midY}
                    fill={color}
                    fontSize="11"
                    fontFamily="monospace"
                    textAnchor="middle"
                    dy="-2"
                  >
                    {e.action === 'P' ? 'pass' : 'bet'}
                  </text>
                </g>
              )
            })}

            {/* nodes */}
            {nodes.map((n) => {
              const { x, y } = xy(n)
              const isHover = hoveredId === n.id
              const isInfo = n.kind === 'info'
              const strat = n.infoSetKey ? KUHN_NASH[n.infoSetKey] : null
              return (
                <g
                  key={n.id}
                  transform={`translate(${x}, ${y})`}
                  style={{ cursor: isInfo ? 'pointer' : 'default' }}
                  onMouseEnter={() => isInfo && setHoveredId(n.id)}
                  onMouseLeave={() => isInfo && setHoveredId(null)}
                >
                  {isInfo ? (
                    <>
                      <rect
                        x={-46}
                        y={-15}
                        width={92}
                        height={30}
                        rx={6}
                        fill={isHover ? 'rgba(139,92,246,0.18)' : 'rgba(20,20,30,0.9)'}
                        stroke={isHover ? '#8B5CF6' : 'rgba(255,255,255,0.12)'}
                        strokeWidth={isHover ? 1.5 : 1}
                      />
                      <text x={0} y={-2} fill="#F5F5FA" fontSize="11" textAnchor="middle" fontWeight="600">
                        {n.label}
                      </text>
                      {strat && (
                        <>
                          {/* tiny strategy bars beneath the label */}
                          <rect x={-38} y={4} width={76 * strat.pass} height={5} fill="#22C55E" opacity="0.85" />
                          <rect x={-38 + 76 * strat.pass} y={4} width={76 * strat.bet} height={5} fill="#8B5CF6" opacity="0.85" />
                        </>
                      )}
                    </>
                  ) : (
                    <>
                      <circle r={14} fill="rgba(20,20,30,0.9)" stroke="rgba(255,255,255,0.18)" strokeWidth={1} />
                      <text x={0} y={4} fill="#A1A1B5" fontSize="11" textAnchor="middle" fontFamily="monospace">
                        {n.payoff}
                      </text>
                    </>
                  )}
                </g>
              )
            })}
          </svg>
        </div>

        <div className="w-full md:w-56 shrink-0 p-3 rounded-lg bg-bg-overlay border border-border-subtle">
          <p className="text-text-tertiary text-[10px] uppercase tracking-wider mb-2">
            {hoveredNode ? 'Info set' : 'Hover any decision node'}
          </p>
          {hoveredNode && hoveredNode.infoSetKey ? (
            <>
              <p className="text-text-primary font-mono text-sm mb-3 break-all">{hoveredNode.infoSetKey}</p>
              {hoveredStrategy ? (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="w-10 text-[10px] text-text-secondary font-mono">Pass</span>
                    <div className="flex-1 h-2.5 rounded bg-bg-elevated overflow-hidden">
                      <div className="h-full" style={{ width: `${hoveredStrategy.pass * 100}%`, backgroundColor: '#22C55E', opacity: 0.85 }} />
                    </div>
                    <span className="w-10 text-right text-[10px] text-text-primary font-mono">{(hoveredStrategy.pass * 100).toFixed(0)}%</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-10 text-[10px] text-text-secondary font-mono">Bet</span>
                    <div className="flex-1 h-2.5 rounded bg-bg-elevated overflow-hidden">
                      <div className="h-full" style={{ width: `${hoveredStrategy.bet * 100}%`, backgroundColor: '#8B5CF6', opacity: 0.85 }} />
                    </div>
                    <span className="w-10 text-right text-[10px] text-text-primary font-mono">{(hoveredStrategy.bet * 100).toFixed(0)}%</span>
                  </div>
                </div>
              ) : (
                <p className="text-text-tertiary text-xs">P2's card is unknown — they have their own info set per card.</p>
              )}
            </>
          ) : (
            <p className="text-text-tertiary text-xs leading-relaxed">
              Each rounded box is a decision point — an <span className="text-text-primary">info set</span>. The little
              green/purple bars under each label are that node's Nash strategy: probability of Pass vs. Bet. Circles are
              terminal payoffs (P1's perspective).
            </p>
          )}
        </div>
      </div>

      <p className="text-text-tertiary text-xs mt-3 leading-relaxed">
        Kuhn poker has 12 info sets total (3 cards × 4 reachable histories). This view shows P1's subtree for one card.
        P2's nodes are placeholders — they have their own three-card-indexed info sets you can't see, which is the
        whole point of imperfect information.
      </p>
    </div>
  )
}

function normalize(v: number[]): number[] {
  const sum = v.reduce((a, b) => a + b, 0)
  if (sum === 0) return v.map(() => 1 / v.length)
  return v.map((x) => x / sum)
}

function discountFn(t: number, param: number): number {
  if (!isFinite(param)) return 1
  return Math.pow(t, param) / (Math.pow(t, param) + 1)
}

const PRESETS: Array<{ name: string; alpha: number; beta: number; gamma: number; clip: boolean }> = [
  { name: 'MCCFR',  alpha: Infinity, beta: Infinity, gamma: Infinity, clip: false },
  { name: 'MCCFR+', alpha: Infinity, beta: Infinity, gamma: Infinity, clip: true },
  { name: 'LCFR',   alpha: 1,        beta: 1,        gamma: 1,        clip: false },
  { name: 'DCFR',   alpha: 1.5,      beta: 0,        gamma: 2,        clip: false },
  { name: 'DCFR+',  alpha: 1.5,      beta: 0,        gamma: 2,        clip: true },
]

function ParamSlider({
  label,
  hint,
  value,
  onChange,
  color,
}: {
  label: string
  hint: string
  value: number
  onChange: (v: number) => void
  color: string
}) {
  const isInf = !isFinite(value)
  return (
    <div className="flex items-center gap-2">
      <div className="w-20 flex flex-col">
        <span className="text-sm font-mono font-medium" style={{ color }}>{label}</span>
        <span className="text-[10px] text-text-tertiary leading-tight">{hint}</span>
      </div>
      <input
        type="range"
        min={0}
        max={3}
        step={0.1}
        value={isInf ? 3 : value}
        disabled={isInf}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="flex-1 h-1.5 rounded-full disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
        style={{ accentColor: color }}
      />
      <span className="w-8 text-right text-sm font-mono text-text-primary tabular-nums">
        {isInf ? '∞' : value.toFixed(1)}
      </span>
      <button
        onClick={() => onChange(isInf ? 1 : Infinity)}
        className={`w-7 h-7 rounded flex items-center justify-center text-xs font-mono cursor-pointer transition-colors border ${
          isInf
            ? 'border-accent-purple/50 bg-accent-purple/20 text-accent-purple'
            : 'border-border-subtle bg-bg-overlay text-text-tertiary hover:text-text-secondary'
        }`}
      >
        ∞
      </button>
    </div>
  )
}

function DiscountedRegretDemo() {
  const [alpha, setAlpha] = useState(Infinity)
  const [beta, setBeta] = useState(Infinity)
  const [gamma, setGamma] = useState(Infinity)
  const [clip, setClip] = useState(false)
  const [preset, setPreset] = useState('MCCFR')

  const [regretP1, setRegretP1] = useState<number[]>([0, 0, 0])
  const [regretP2, setRegretP2] = useState<number[]>([0, 0, 0])
  const [stratSumP1, setStratSumP1] = useState<number[]>([0, 0, 0])
  const [iter, setIter] = useState(0)

  const [phase, setPhase] = useState<'idle' | 'shaking' | 'thrown' | 'updating'>('idle')
  const [updateStep, setUpdateStep] = useState(-1)
  const [p1, setP1] = useState(0)
  const [p2, setP2] = useState(0)
  const [shakeIdx, setShakeIdx] = useState(0)
  const [autoPlay, setAutoPlay] = useState(false)
  const [history, setHistory] = useState<Array<{ p1: number; p2: number; payoff: number }>>([])

  const p1Ref = useRef(0)
  const p2Ref = useRef(0)
  const regretP1Ref = useRef(regretP1)
  const regretP2Ref = useRef(regretP2)
  const iterRef = useRef(iter)
  const alphaRef = useRef(alpha)
  const betaRef = useRef(beta)
  const gammaRef = useRef(gamma)
  const clipRef = useRef(clip)

  useEffect(() => {
    regretP1Ref.current = regretP1
    regretP2Ref.current = regretP2
    iterRef.current = iter
    alphaRef.current = alpha
    betaRef.current = beta
    gammaRef.current = gamma
    clipRef.current = clip
  }, [regretP1, regretP2, iter, alpha, beta, gamma, clip])

  const strategyP1 = useMemo(() => strategyFromRegret(regretP1), [regretP1])
  const avgStrategyP1 = useMemo(() => normalize(stratSumP1), [stratSumP1])
  const maxRegret = Math.max(2, ...regretP1.map(Math.abs))

  const payoff = RPS_PAYOFF[p1][p2]
  const cfValues = [0, 1, 2].map((a) => RPS_PAYOFF[a][p2])
  const deltas = cfValues.map((cf) => cf - payoff)

  function selectPreset(name: string) {
    const p = PRESETS.find((pr) => pr.name === name)
    if (p) {
      setAlpha(p.alpha)
      setBeta(p.beta)
      setGamma(p.gamma)
      setClip(p.clip)
      setPreset(name)
    } else {
      setPreset('Custom')
    }
  }

  function setParam(setter: (v: number) => void, value: number) {
    setter(value)
    setPreset('Custom')
  }

  useEffect(() => {
    if (phase !== 'shaking') return
    const id = setInterval(() => setShakeIdx((i) => (i + 1) % 3), 80)
    return () => clearInterval(id)
  }, [phase])

  useEffect(() => {
    if (phase === 'idle') return undefined
    let timeout: ReturnType<typeof setTimeout> | undefined

    if (phase === 'shaking') {
      timeout = setTimeout(() => setPhase('thrown'), 900)
    } else if (phase === 'thrown') {
      timeout = setTimeout(() => {
        setUpdateStep(0)
        setPhase('updating')
      }, 1000)
    } else if (phase === 'updating') {
      if (updateStep < 2) {
        timeout = setTimeout(() => setUpdateStep((s) => s + 1), 550)
      } else {
        timeout = setTimeout(() => {
          const p1v = p1Ref.current
          const p2v = p2Ref.current
          const t = iterRef.current + 1
          const a = alphaRef.current
          const b = betaRef.current
          const g = gammaRef.current
          const c = clipRef.current
          const pf = RPS_PAYOFF[p1v][p2v]

          const ds1 = [0, 1, 2].map((act) => RPS_PAYOFF[act][p2v] - pf)
          const stratBefore = strategyFromRegret(regretP1Ref.current)
          setRegretP1((prev) =>
            prev.map((r, i) => {
              let updated = r + ds1[i]
              updated *= updated >= 0 ? discountFn(t, a) : discountFn(t, b)
              if (c) updated = Math.max(0, updated)
              return updated
            }),
          )
          setStratSumP1((prev) =>
            prev.map((s, i) => s * discountFn(t, g) + stratBefore[i]),
          )

          const p2pf = -pf
          const ds2 = [0, 1, 2].map((act) => -RPS_PAYOFF[p1v][act] - p2pf)
          setRegretP2((prev) =>
            prev.map((r, i) => {
              let updated = r + ds2[i]
              updated *= updated >= 0 ? discountFn(t, a) : discountFn(t, b)
              if (c) updated = Math.max(0, updated)
              return updated
            }),
          )

          setIter(t)
          setHistory((prev) => [...prev.slice(-29), { p1: p1v, p2: p2v, payoff: pf }])
          setUpdateStep(-1)
          setPhase('idle')
        }, 650)
      }
    }

    return () => { if (timeout) clearTimeout(timeout) }
  }, [phase, updateStep])

  function startRound() {
    if (phase !== 'idle') return
    const sP1 = strategyFromRegret(regretP1Ref.current)
    const sP2 = strategyFromRegret(regretP2Ref.current)
    const chosenP1 = sample(sP1)
    const chosenP2 = sample(sP2)
    setP1(chosenP1)
    setP2(chosenP2)
    p1Ref.current = chosenP1
    p2Ref.current = chosenP2
    setPhase('shaking')
  }

  function reset() {
    setRegretP1([0, 0, 0])
    setRegretP2([0, 0, 0])
    setStratSumP1([0, 0, 0])
    setIter(0)
    setPhase('idle')
    setHistory([])
    setAutoPlay(false)
    setUpdateStep(-1)
  }

  useEffect(() => {
    if (!autoPlay || phase !== 'idle') return
    const id = setTimeout(startRound, 350)
    return () => clearTimeout(id)
  }, [autoPlay, phase])

  const outcomeLabel = payoff === 1 ? 'WIN' : payoff === -1 ? 'LOSE' : 'TIE'
  const outcomeColor = payoff === 1 ? '#22C55E' : payoff === -1 ? '#EF4444' : '#A1A1B5'
  const isRevealed = phase === 'thrown' || phase === 'updating'

  return (
    <div className="p-6 rounded-xl bg-bg-elevated border border-border-subtle">
      <div className="flex items-baseline justify-between mb-4 flex-wrap gap-2">
        <p className="text-text-secondary text-sm">
          <span className="text-text-primary font-medium">Discounted CFR playground.</span>{' '}
          Same RPS self-play, now with α, β, γ and clipping controls.
        </p>
        <p className="text-text-tertiary text-xs font-mono">round {iter}</p>
      </div>

      {/* Preset + parameter controls */}
      <div className="mb-5 p-4 rounded-lg bg-bg-overlay border border-border-subtle">
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <span className="text-text-tertiary text-xs uppercase tracking-wider">Preset</span>
          <select
            value={preset}
            onChange={(e) => selectPreset(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-bg-base border border-border-subtle text-text-primary text-sm font-mono cursor-pointer"
          >
            {PRESETS.map((p) => (
              <option key={p.name} value={p.name}>{p.name}</option>
            ))}
            <option value="Custom">Custom</option>
          </select>
        </div>

        <div className="space-y-3">
          <ParamSlider label="α" hint="pos. regret" value={alpha} onChange={(v) => setParam(setAlpha, v)} color="#22C55E" />
          <ParamSlider label="β" hint="neg. regret" value={beta} onChange={(v) => setParam(setBeta, v)} color="#8B5CF6" />
          <ParamSlider label="γ" hint="avg. weight" value={gamma} onChange={(v) => setParam(setGamma, v)} color="#3B82F6" />
          <div className="flex items-center gap-2">
            <div className="w-20 flex flex-col">
              <span className="text-sm font-mono font-medium text-accent-red">Clip</span>
              <span className="text-[10px] text-text-tertiary leading-tight">floor to 0</span>
            </div>
            <button
              onClick={() => { setClip(!clip); setPreset('Custom') }}
              className={`w-10 h-6 rounded-full relative cursor-pointer transition-colors ${
                clip ? 'bg-accent-green' : 'bg-bg-base border border-border-subtle'
              }`}
            >
              <motion.div
                animate={{ x: clip ? 18 : 2 }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                className="absolute top-1 w-4 h-4 rounded-full bg-white shadow"
              />
            </button>
            <span className="text-text-secondary text-xs font-mono">{clip ? 'on' : 'off'}</span>
          </div>
        </div>
      </div>

      {/* Throw arena */}
      <div className="flex items-center justify-center gap-6 sm:gap-10 py-6 mb-5 rounded-lg bg-bg-overlay border border-border-subtle">
        <ThrowDisplay phase={phase} label="P1" choice={p1} shakeIdx={shakeIdx} />
        <div className="flex flex-col items-center gap-1 min-w-[72px]">
          {isRevealed ? (
            <motion.div
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="flex flex-col items-center"
            >
              <span className="text-xl font-display font-bold" style={{ color: outcomeColor }}>
                {outcomeLabel}
              </span>
              <span className="font-mono text-sm" style={{ color: outcomeColor }}>
                {payoff >= 0 ? '+' : ''}{payoff}
              </span>
            </motion.div>
          ) : phase === 'shaking' ? (
            <motion.span
              animate={{ opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 0.6, repeat: Infinity }}
              className="text-text-tertiary text-sm font-display"
            >
              ...
            </motion.span>
          ) : (
            <span className="text-text-tertiary text-lg font-display">vs</span>
          )}
        </div>
        <ThrowDisplay phase={phase} label="P2" choice={p2} shakeIdx={(shakeIdx + 1) % 3} />
      </div>

      {/* Regret update breakdown */}
      <AnimatePresence>
        {phase === 'updating' && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-5 p-4 rounded-lg bg-bg-base border border-border-subtle overflow-hidden"
          >
            <p className="text-text-tertiary text-xs uppercase tracking-wider mb-3">
              Regret update ({preset !== 'Custom' ? preset : 'custom'} discounting)
            </p>
            <p className="text-text-secondary text-xs mb-3">
              P1 played{' '}
              <span className="font-medium" style={{ color: RPS_ACTIONS[p1].color }}>
                {RPS_ACTIONS[p1].name}
              </span>{' '}
              against{' '}
              <span className="font-medium" style={{ color: RPS_ACTIONS[p2].color }}>
                {RPS_ACTIONS[p2].name}
              </span>{' '}
              → payoff{' '}
              <span className="font-mono font-medium" style={{ color: outcomeColor }}>
                {payoff >= 0 ? '+' : ''}{payoff}
              </span>
            </p>
            <div className="space-y-1.5">
              {[0, 1, 2].map((a) => {
                const visible = a <= updateStep
                const cf = cfValues[a]
                const delta = deltas[a]
                const isChosen = a === p1
                return (
                  <motion.div
                    key={a}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: visible ? 1 : 0.2, x: visible ? 0 : -10 }}
                    transition={{ duration: 0.3 }}
                    className={`flex items-center gap-2 sm:gap-3 py-1.5 px-3 rounded text-sm ${
                      visible && a === updateStep ? 'bg-bg-overlay' : ''
                    }`}
                  >
                    <span className="text-base">{RPS_EMOJI[a]}</span>
                    <span className="w-14 text-text-secondary text-xs">{RPS_ACTIONS[a].name}</span>
                    {visible && (
                      <>
                        <span className="text-text-tertiary text-xs">would get</span>
                        <span
                          className="font-mono text-xs w-6 text-center"
                          style={{ color: cf > 0 ? '#22C55E' : cf < 0 ? '#EF4444' : '#A1A1B5' }}
                        >
                          {cf >= 0 ? '+' : ''}{cf}
                        </span>
                        <span className="text-text-tertiary text-xs">→ regret</span>
                        <motion.span
                          initial={{ scale: 1.4 }}
                          animate={{ scale: 1 }}
                          className="font-mono text-sm font-semibold min-w-[2.5rem] text-center"
                          style={{ color: delta > 0 ? '#22C55E' : delta < 0 ? '#EF4444' : '#A1A1B5' }}
                        >
                          {delta >= 0 ? '+' : ''}{delta}
                        </motion.span>
                        {isChosen && (
                          <span className="text-[10px] text-text-tertiary bg-bg-overlay px-1.5 py-0.5 rounded">
                            played
                          </span>
                        )}
                      </>
                    )}
                  </motion.div>
                )
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Accumulated regret bars */}
      <div className="space-y-2 mb-5">
        <p className="text-text-tertiary text-xs uppercase tracking-wider mb-2">P1 accumulated regret</p>
        {RPS_ACTIONS.map((a, i) => (
          <RegretBar key={a.name} label={a.name} value={regretP1[i]} color={a.color} max={maxRegret} />
        ))}
      </div>

      {/* Current + Average strategy */}
      <div className="grid md:grid-cols-2 gap-5 mb-5">
        <div className="space-y-2">
          <p className="text-text-tertiary text-xs uppercase tracking-wider mb-2">
            P1 current strategy <span className="normal-case text-text-tertiary/70">(from regret matching)</span>
          </p>
          {RPS_ACTIONS.map((a, i) => (
            <StrategyBar key={a.name} label={a.name} prob={strategyP1[i]} color={a.color} />
          ))}
        </div>
        <div className="space-y-2">
          <p className="text-text-tertiary text-xs uppercase tracking-wider mb-2">
            P1 average strategy <span className="normal-case text-text-tertiary/70">(running mean)</span>
          </p>
          {RPS_ACTIONS.map((a, i) => (
            <StrategyBar key={a.name} label={a.name} prob={avgStrategyP1[i]} color={a.color} />
          ))}
        </div>
      </div>

      {/* Controls */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={startRound}
          disabled={phase !== 'idle'}
          className="px-4 py-2 rounded-lg bg-accent-purple text-white text-sm font-medium cursor-pointer hover:shadow-[0_0_16px_var(--color-accent-purple-glow)] transition-shadow disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {phase !== 'idle' ? 'Playing...' : 'Play Round'}
        </button>
        <button
          onClick={() => setAutoPlay((a) => !a)}
          className={`px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors ${
            autoPlay
              ? 'bg-accent-red text-white hover:bg-accent-red/80'
              : 'bg-accent-purple/60 text-white hover:bg-accent-purple/80'
          }`}
        >
          {autoPlay ? 'Stop' : 'Auto Play'}
        </button>
        <button
          onClick={reset}
          className="px-4 py-2 rounded-lg bg-bg-overlay text-text-secondary text-sm font-medium border border-border-subtle cursor-pointer hover:text-text-primary transition-colors"
        >
          Reset
        </button>
      </div>

      {/* Round history */}
      {history.length > 0 && (
        <div className="mt-4 flex gap-1 flex-wrap">
          {history.map((h, i) => (
            <div
              key={i}
              className="w-7 h-7 rounded flex items-center justify-center text-xs cursor-default"
              style={{
                backgroundColor:
                  h.payoff === 1
                    ? 'rgba(34,197,94,0.15)'
                    : h.payoff === -1
                      ? 'rgba(239,68,68,0.15)'
                      : 'rgba(161,161,181,0.08)',
              }}
              title={`${RPS_ACTIONS[h.p1].name} vs ${RPS_ACTIONS[h.p2].name}: ${h.payoff >= 0 ? '+' : ''}${h.payoff}`}
            >
              <span style={{ fontSize: '14px' }}>{RPS_EMOJI[h.p1]}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function WhatIsCFR() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-bg-base text-text-primary">
      {/* Top bar */}
      <div className="sticky top-0 z-20 h-12 flex items-center px-4 border-b border-border-subtle bg-bg-elevated/80 backdrop-blur">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-overlay transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm">Back</span>
        </button>
      </div>

      <div className="px-6 py-12 flex flex-col gap-16">
        {/* Hero */}
        <Section>
          <div className="flex items-center gap-3 mb-4">
            <Brain className="w-8 h-8 text-accent-purple" />
            <h1 className="font-display text-4xl font-bold tracking-tight">What is CFR?</h1>
          </div>
          <p className="text-text-secondary text-lg leading-relaxed">
            <span className="text-text-primary font-semibold">Counterfactual Regret Minimization</span>{' '}
            (CFR) is the algorithm family behind nearly every competitive poker bot. Plain English: the bot plays the
            game against itself millions of times, keeping a running tally of <em>"how much better would I have done if
            I'd played action X instead?"</em> The tally is called <em>regret</em>, and over time the strategy gravitates
            toward actions whose regret is large and positive. Average that evolving strategy and you get something
            arbitrarily close to a Nash equilibrium.
          </p>
        </Section>

        {/* Regret */}
        <Section delay={0.05}>
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-5 h-5 text-accent-purple" />
            <h2 className="font-display text-2xl font-semibold">Regret</h2>
          </div>
          <p className="text-text-secondary leading-relaxed mb-4">
            At every decision point, after playing a hand, the bot asks of each available action:{' '}
            <span className="text-text-primary">"how much better than what I actually did would this have been?"</span>{' '}
            Positive answer → I should do this more next time. Negative → I should do this less. CFR adds those
            answers up over millions of hands.
          </p>
          <p className="text-text-secondary leading-relaxed mb-5">
            The strategy is then computed by{' '}
            <span className="text-text-primary font-mono">strategy[a] = max(0, regret[a]) / Σ max(0, regret)</span> —
            actions with bigger positive regret get more probability. Try it:
          </p>
          <RegretDemo />
          <p className="text-text-tertiary text-xs mt-3 leading-relaxed">
            Each round: both players sample an action from their current strategy. The payoff is{' '}
            <span className="text-text-primary">+1</span> (win),{' '}
            <span className="text-text-primary">−1</span> (lose), or{' '}
            <span className="text-text-primary">0</span> (tie). Then for each alternative action,
            counterfactual regret = (what that action would have scored) − (what was actually scored).
            Over many rounds, the strategy converges toward the Nash equilibrium of uniform 33% / 33% / 33%.
          </p>
        </Section>

        {/* Game tree */}
        <Section delay={0.05}>
          <div className="flex items-center gap-2 mb-3">
            <GitBranch className="w-5 h-5 text-accent-purple" />
            <h2 className="font-display text-2xl font-semibold">The game tree</h2>
          </div>
          <p className="text-text-secondary leading-relaxed mb-5">
            CFR operates on the <em>game tree</em>: a tree where every internal node is a decision and every leaf is a
            payoff. Decisions that look identical from the deciding player's point of view get collapsed into a single
            <span className="text-text-primary"> info set</span> — and CFR maintains one regret vector and one strategy
            per info set, not per game state. Here's a real subtree from Kuhn poker:
          </p>
          <KuhnTree />
        </Section>

        {/* Alpha / Beta */}
        <Section delay={0.05}>
          <div className="flex items-center gap-2 mb-3">
            <TrendingDown className="w-5 h-5 text-accent-purple" />
            <h2 className="font-display text-2xl font-semibold">α and β — discounting old regret</h2>
          </div>
          <p className="text-text-secondary leading-relaxed mb-4">
            Early iterations are based on a random-ish strategy, so the regret they produce is mostly noise. Smart
            CFR variants <em>discount</em> the old running sum before adding the new regret — fresh data dominates
            stale data.
          </p>
          <ul className="text-text-secondary leading-relaxed mb-5 space-y-2 list-none">
            <li>
              <span className="text-accent-green font-mono">α</span> controls how fast{' '}
              <span className="text-text-primary">positive</span> regret decays.
            </li>
            <li>
              <span className="text-accent-purple font-mono">β</span> controls how fast{' '}
              <span className="text-text-primary">negative</span> regret decays.
            </li>
          </ul>
          <p className="text-text-secondary leading-relaxed mb-5">
            Why two knobs? Because a huge negative regret accumulated early ("this action looked terrible at iter 50")
            can take forever to climb back from. Discounting negatives faster (β small) lets the bot rediscover good
            actions that started out unlucky. This is the asymmetry that makes DCFR (α = 1.5, β = 0) so effective.
          </p>
          <DiscountVisual />
        </Section>

        {/* Gamma */}
        <Section delay={0.05}>
          <div className="flex items-center gap-2 mb-3">
            <Layers className="w-5 h-5 text-accent-purple" />
            <h2 className="font-display text-2xl font-semibold">γ — averaging the strategy</h2>
          </div>
          <p className="text-text-secondary leading-relaxed">
            CFR's convergence guarantee is on the <em>average</em> strategy over all iterations, not the strategy
            at any single moment. <span className="text-accent-purple font-mono">γ</span> tunes how much weight
            recent iterations get in that average. <span className="font-mono">γ = ∞</span> reproduces linear-by-iteration
            weighting (the standard MCCFR default). <span className="font-mono">γ = 2</span> (DCFR) weights recent
            iterations more aggressively, since by then the strategy is better-informed.
          </p>
        </Section>

        {/* Clipping */}
        <Section delay={0.05}>
          <div className="flex items-center gap-2 mb-3">
            <Scissors className="w-5 h-5 text-accent-purple" />
            <h2 className="font-display text-2xl font-semibold">Clipping — the "+" in CFR+</h2>
          </div>
          <p className="text-text-secondary leading-relaxed">
            Same problem as β, attacked differently: instead of smoothly shrinking negative regret each iteration,
            just <span className="text-text-primary">hard-clip it to zero</span> right after the update. Any action
            with regret ≤ 0 starts fresh from zero next iteration. Empirically this is one of the single biggest
            wins in CFR research — it's what the "+" means in CFR+, MCCFR+, and DCFR+.
          </p>
        </Section>

        {/* Variants table */}
        <Section delay={0.05}>
          <h2 className="font-display text-2xl font-semibold mb-4">Variants at a glance</h2>
          <div className="overflow-x-auto rounded-xl border border-border-subtle">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-bg-elevated text-text-tertiary text-xs uppercase tracking-wider">
                  <th className="text-left px-4 py-3 font-medium">Variant</th>
                  <th className="text-left px-4 py-3 font-medium">α</th>
                  <th className="text-left px-4 py-3 font-medium">β</th>
                  <th className="text-left px-4 py-3 font-medium">γ</th>
                  <th className="text-left px-4 py-3 font-medium">Clip</th>
                  <th className="text-left px-4 py-3 font-medium">Idea</th>
                </tr>
              </thead>
              <tbody className="font-mono">
                <tr className="border-t border-border-subtle">
                  <td className="px-4 py-3 text-text-primary">MCCFR</td>
                  <td className="px-4 py-3">∞</td>
                  <td className="px-4 py-3">∞</td>
                  <td className="px-4 py-3">∞</td>
                  <td className="px-4 py-3">no</td>
                  <td className="px-4 py-3 font-sans text-text-secondary">Baseline. No discounting.</td>
                </tr>
                <tr className="border-t border-border-subtle">
                  <td className="px-4 py-3 text-text-primary">MCCFR+</td>
                  <td className="px-4 py-3">∞</td>
                  <td className="px-4 py-3">∞</td>
                  <td className="px-4 py-3">∞</td>
                  <td className="px-4 py-3 text-accent-green">yes</td>
                  <td className="px-4 py-3 font-sans text-text-secondary">Clipping alone is a huge win.</td>
                </tr>
                <tr className="border-t border-border-subtle">
                  <td className="px-4 py-3 text-text-primary">LCFR</td>
                  <td className="px-4 py-3">1</td>
                  <td className="px-4 py-3">1</td>
                  <td className="px-4 py-3">1</td>
                  <td className="px-4 py-3">no</td>
                  <td className="px-4 py-3 font-sans text-text-secondary">Linear weighting everywhere.</td>
                </tr>
                <tr className="border-t border-border-subtle">
                  <td className="px-4 py-3 text-text-primary">DCFR</td>
                  <td className="px-4 py-3">1.5</td>
                  <td className="px-4 py-3">0</td>
                  <td className="px-4 py-3">2</td>
                  <td className="px-4 py-3">no</td>
                  <td className="px-4 py-3 font-sans text-text-secondary">Asymmetric discount, soft "+".</td>
                </tr>
                <tr className="border-t border-border-subtle">
                  <td className="px-4 py-3 text-text-primary">DCFR+</td>
                  <td className="px-4 py-3">1.5</td>
                  <td className="px-4 py-3">0</td>
                  <td className="px-4 py-3">2</td>
                  <td className="px-4 py-3 text-accent-green">yes</td>
                  <td className="px-4 py-3 font-sans text-text-secondary">DCFR + hard clip.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Section>

        {/* Playground */}
        <Section delay={0.05}>
          <div className="flex items-center gap-2 mb-3">
            <SlidersHorizontal className="w-5 h-5 text-accent-purple" />
            <h2 className="font-display text-2xl font-semibold">Playground — try the variants</h2>
          </div>
          <p className="text-text-secondary leading-relaxed mb-5">
            Pick a preset from the table above or dial in your own α, β, γ and clipping settings.
            Watch how different discount parameters change the way regret accumulates and how fast the
            average strategy converges to Nash equilibrium.
          </p>
          <DiscountedRegretDemo />
        </Section>

        {/* Footer */}
        <Section delay={0.05}>
          <div className="text-center pb-6">
            <button
              onClick={() => navigate('/')}
              className="px-8 py-3 rounded-xl bg-accent-purple text-white font-display font-semibold cursor-pointer hover:shadow-[0_0_24px_var(--color-accent-purple-glow)] transition-shadow"
            >
              Back to Lobby
            </button>
          </div>
        </Section>
      </div>
    </div>
  )
}

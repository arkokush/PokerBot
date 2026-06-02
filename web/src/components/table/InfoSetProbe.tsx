import { motion } from 'framer-motion'
import type { StrategyProbe } from '../../bots/mccfr'

const LABEL_MAP: Record<string, string> = {
  P: 'Pass',
  B: 'Bet',
  C: 'Call',
  F: 'Fold',
  R: 'Raise',
}

const COLOR_MAP: Record<string, string> = {
  P: '#22C55E',
  B: '#8B5CF6',
  C: '#4ADE80',
  F: '#EF4444',
  R: '#A78BFA',
}

interface Props {
  probe: StrategyProbe
  isActing: boolean
}

export function InfoSetProbe({ probe, isActing }: Props) {
  return (
    <div
      className={`mt-3 p-3 rounded-lg border ${isActing ? 'border-accent-purple/40 bg-accent-purple/5' : 'border-border-subtle bg-bg-overlay/40'}`}
      style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.02)' }}
    >
      <div className="flex items-center justify-between mb-2">
        <p className="text-text-tertiary text-[10px] uppercase tracking-[0.18em] font-medium">Info Set</p>
        {isActing && (
          <span className="text-accent-purple text-[10px] uppercase tracking-wider font-medium">deciding</span>
        )}
      </div>
      <p className="text-text-primary text-xs font-mono break-all mb-2.5">{probe.key}</p>
      <div className="space-y-1">
        {probe.actions.map((a, i) => {
          const p = probe.probs[i] ?? 0
          return (
            <div key={`${a}-${i}`} className="flex items-center gap-2">
              <div className="w-10 text-[10px] text-text-secondary font-mono">{LABEL_MAP[a] ?? a}</div>
              <div className="flex-1 h-3 rounded-sm bg-bg-elevated overflow-hidden border border-border-subtle">
                <motion.div
                  animate={{ width: `${p * 100}%` }}
                  transition={{ type: 'spring', stiffness: 200, damping: 22 }}
                  className="h-full"
                  style={{ backgroundColor: COLOR_MAP[a] ?? '#8B5CF6', opacity: 0.85 }}
                />
              </div>
              <div className="w-10 text-right text-[10px] text-text-primary font-mono tabular-nums">
                {(p * 100).toFixed(1)}%
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

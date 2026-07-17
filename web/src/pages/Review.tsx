import { useNavigate, useParams } from 'react-router-dom'
import { useGameStore } from '../stores/gameStore'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, Legend, PieChart, Pie, Cell } from 'recharts'
import { ArrowLeft, Trophy } from 'lucide-react'

export function Review() {
  const navigate = useNavigate()
  const { sessionId } = useParams()
  const session = useGameStore((s) => s.session)

  if (!session || session.id !== sessionId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-text-secondary mb-4">Session not found</p>
          <button onClick={() => navigate('/')} className="px-6 py-2 rounded-xl bg-accent-purple text-white font-medium cursor-pointer">
            Back to Lobby
          </button>
        </div>
      </div>
    )
  }

  const { handHistory, config, state } = session
  const players = state?.players ?? []

  // Compute stats
  const p1Wins = handHistory.filter((h) => h.winner === 0).length
  const p2Wins = handHistory.filter((h) => h.winner === 1).length
  const totalHands = handHistory.length

  // Compute profit over time
  const getProfit = (playerId: number) => {
    if (config.infiniteStack) {
      return handHistory.reduce((sum, h) => sum + (h.netByPlayer?.[playerId] ?? 0), 0)
    }
    const player = players.find((p) => p.id === playerId)
    return player ? player.stack - config.startingStack : 0
  }

  const p1Profit = getProfit(0)
  const p2Profit = getProfit(1)

  const chartData = (() => {
    if (config.infiniteStack) {
      // Cumulative net chips over time
      let cum0 = 0
      let cum1 = 0
      return handHistory.map((h) => {
        cum0 += h.netByPlayer?.[0] ?? 0
        cum1 += h.netByPlayer?.[1] ?? 0
        return {
          hand: h.handNumber,
          [players[0]?.name ?? 'P1']: cum0,
          [players[1]?.name ?? 'P2']: cum1,
        }
      })
    }
    return handHistory.map((h) => ({
      hand: h.handNumber,
      [players[0]?.name ?? 'P1']: h.players[0]?.stack ?? 0,
      [players[1]?.name ?? 'P2']: h.players[1]?.stack ?? 0,
    }))
  })()

  const actionCounts = players.map((p) => {
    const counts: Record<string, number> = { fold: 0, check: 0, call: 0, bet: 0, raise: 0 }
    handHistory.forEach((h) => {
      h.actions.forEach((a) => {
        if (a.playerIndex === p.id) counts[a.action.type]++
      })
    })
    return { name: p.name, ...counts }
  })

  const winData = [
    { name: players[0]?.name ?? 'P1', value: p1Wins },
    { name: players[1]?.name ?? 'P2', value: p2Wins },
  ]
  const PIE_COLORS = ['#8B5CF6', '#22C55E']

  const overallWinner = p1Profit > p2Profit ? players[0] : p2Profit > p1Profit ? players[1] : null
  // Stats attributed to the actual profit winner (they may have won fewer hands)
  const winnerIsP1 = overallWinner?.id === 0
  const winnerWins = winnerIsP1 ? p1Wins : p2Wins
  const loserWins = winnerIsP1 ? p2Wins : p1Wins
  const winnerProfit = winnerIsP1 ? p1Profit : p2Profit

  return (
    <div className="min-h-screen flex flex-col py-8 px-6">
      <div className="max-w-5xl mx-auto w-full">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => navigate('/')}
            className="p-2 rounded-lg hover:bg-bg-elevated transition-colors text-text-secondary hover:text-text-primary cursor-pointer"
            aria-label="Back to lobby"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="font-display text-2xl font-bold text-text-primary">Match Review</h1>
            <p className="text-text-secondary text-sm">
              {config.variant === 'kuhn' ? 'Kuhn Poker' : config.variant === 'leduc' ? 'Leduc Hold\'em' : 'Limit Hold\'em'}
              {' \u00B7 '}{totalHands} hands played
            </p>
          </div>
        </div>

        {/* Winner Banner */}
        {overallWinner && (
          <div className="mb-8 p-6 rounded-xl bg-bg-elevated border border-accent-green/30 flex items-center gap-4" style={{ boxShadow: '0 0 24px rgba(34, 197, 94, 0.15)' }}>
            <Trophy className="w-8 h-8 text-accent-green" />
            <div>
              <p className="font-display text-lg font-bold text-text-primary">{overallWinner.name} wins the match</p>
              <p className="text-text-secondary text-sm">
                {winnerWins} - {loserWins} hands
                {' \u00B7 '}Profit: {winnerProfit > 0 ? `+${winnerProfit}` : winnerProfit}
              </p>
            </div>
          </div>
        )}

        {/* Charts Grid */}
        <div className="grid grid-cols-2 gap-6 mb-8">
          {/* Stack over time */}
          <div className="p-5 rounded-xl bg-bg-elevated border border-border-subtle" style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)' }}>
            <p className="text-text-tertiary text-xs uppercase tracking-[0.18em] font-medium mb-4">{config.infiniteStack ? 'Profit Over Time' : 'Stack Over Time'}</p>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={chartData}>
                <XAxis dataKey="hand" tick={{ fontSize: 10, fill: '#5C5C70' }} />
                <YAxis tick={{ fontSize: 10, fill: '#5C5C70' }} />
                <Tooltip contentStyle={{ background: '#14141E', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, fontSize: 12 }} />
                <Line type="monotone" dataKey={players[0]?.name ?? 'P1'} stroke="#8B5CF6" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey={players[1]?.name ?? 'P2'} stroke="#22C55E" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Win Distribution */}
          <div className="p-5 rounded-xl bg-bg-elevated border border-border-subtle" style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)' }}>
            <p className="text-text-tertiary text-xs uppercase tracking-[0.18em] font-medium mb-4">Win Distribution</p>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={winData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" label>
                  {winData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: '#14141E', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Action Distribution */}
          <div className="p-5 rounded-xl bg-bg-elevated border border-border-subtle col-span-2" style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)' }}>
            <p className="text-text-tertiary text-xs uppercase tracking-[0.18em] font-medium mb-4">Action Distribution</p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={actionCounts}>
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#5C5C70' }} />
                <YAxis tick={{ fontSize: 10, fill: '#5C5C70' }} />
                <Tooltip contentStyle={{ background: '#14141E', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Bar dataKey="fold" fill="#EF4444" />
                <Bar dataKey="check" fill="#22C55E" />
                <Bar dataKey="call" fill="#4ADE80" />
                <Bar dataKey="bet" fill="#8B5CF6" />
                <Bar dataKey="raise" fill="#A78BFA" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-center gap-4">
          <button
            onClick={() => navigate('/')}
            className="px-8 py-3 rounded-xl bg-accent-purple text-white font-display font-semibold cursor-pointer hover:shadow-[0_0_24px_var(--color-accent-purple-glow)] transition-shadow"
          >
            New Match
          </button>
        </div>
      </div>
    </div>
  )
}

import React from 'react'
import { fmt } from '../helpers.js'

function Stat({ label, value, sub, tone = 'default' }) {
  const tones = {
    default: 'text-slate-100',
    good: 'text-emerald-300',
    warn: 'text-amber-300',
    bad: 'text-rose-300',
  }
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2.5">
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
      <p className={`mt-0.5 text-xl font-bold tabular-nums ${tones[tone]}`}>{value}</p>
      {sub && <p className="text-[11px] text-slate-500">{sub}</p>}
    </div>
  )
}

export default function MetricsBar({ metrics }) {
  if (!metrics) return null
  const pct = metrics.on_time_percentage
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
      <Stat
        label="On-Time %"
        value={`${fmt(pct, 1)}%`}
        sub={`${metrics.on_time_count} of ${metrics.total_orders} served on time`}
        tone={pct >= 80 ? 'good' : pct >= 50 ? 'warn' : 'bad'}
      />
      <Stat
        label="Total Delay"
        value={`${metrics.total_delay}m`}
        sub={`avg ${fmt(metrics.average_delay, 1)}m / order`}
        tone={metrics.total_delay === 0 ? 'good' : 'default'}
      />
      <Stat
        label="Max Tardiness"
        value={`${metrics.max_tardiness}m`}
        sub="worst single ticket"
        tone={metrics.max_tardiness === 0 ? 'good' : metrics.max_tardiness > 20 ? 'bad' : 'warn'}
      />
      <Stat
        label="Delayed"
        value={metrics.delayed_count}
        sub={`${metrics.delayed_count === 0 ? 'none' : 'late tickets'}`}
        tone={metrics.delayed_count === 0 ? 'good' : 'bad'}
      />
      <Stat
        label="Makespan"
        value={`${metrics.makespan}m`}
        sub={`${fmt(metrics.utilisation, 1)}% station busy`}
      />
      <Stat
        label="Total Cost"
        value={fmt(metrics.total_cost, 0)}
        sub="Σ(delay × urgency) + 10 × late"
        tone="warn"
      />
    </div>
  )
}

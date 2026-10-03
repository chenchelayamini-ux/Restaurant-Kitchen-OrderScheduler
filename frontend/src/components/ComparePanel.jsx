import React from 'react'
import { fmt } from '../helpers.js'

export default function ComparePanel({ comparison, onClose }) {
  if (!comparison) return null
  const { rows, best, cost_formula } = comparison
  const worst = Math.max(...rows.map((r) => r.total_cost)) || 1

  return (
    <div className="card">
      <div className="card-head">
        <div>
          <h2 className="text-sm font-bold text-slate-100">Strategy Comparison</h2>
          <p className="font-mono text-[11px] text-emerald-300">{cost_formula}</p>
        </div>
        <button className="btn-ghost !px-2 !py-1 !text-xs" onClick={onClose}>
          Hide
        </button>
      </div>

      <div className="space-y-2 p-3">
        {rows.map((r) => {
          const rel = (r.total_cost / worst) * 100
          return (
            <div
              key={r.key}
              className={`rounded-lg border p-2.5 ${
                r.is_best
                  ? 'border-emerald-500/40 bg-emerald-500/5'
                  : 'border-slate-800 bg-slate-950/40'
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-xs font-semibold text-slate-200">
                  {r.is_best && <span className="text-emerald-400">★</span>}
                  {r.label}
                </span>
                <span className="font-mono text-xs tabular-nums text-amber-300">
                  {fmt(r.total_cost, 0)}
                </span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-800">
                <div
                  className={`h-full rounded-full ${
                    r.is_best
                      ? 'bg-emerald-400'
                      : r.total_cost <= worst * 0.6
                        ? 'bg-amber-400'
                        : 'bg-rose-500/70'
                  }`}
                  style={{ width: `${rel}%` }}
                />
              </div>
              <div className="mt-1.5 flex flex-wrap gap-x-4 font-mono text-[10px] text-slate-500">
                <span>
                  delay <span className="text-slate-300">{r.total_delay}m</span>
                </span>
                <span>
                  max tardiness <span className="text-slate-300">{r.max_tardiness}m</span>
                </span>
                <span>
                  on-time{' '}
                  <span className="text-slate-300">{fmt(r.on_time_percentage, 1)}%</span>
                </span>
                <span>
                  late <span className="text-slate-300">{r.delayed_count}</span>
                </span>
                <span>
                  makespan <span className="text-slate-300">{r.makespan}m</span>
                </span>
              </div>
            </div>
          )
        })}
      </div>

      {best && (
        <p className="border-t border-slate-800 px-3 py-2 text-[11px] text-slate-500">
          Lowest cumulative cost:{' '}
          <span className="font-semibold text-emerald-300">{best.label}</span> at{' '}
          <span className="font-mono text-emerald-300">{fmt(best.total_cost, 0)}</span> points.
        </p>
      )}
    </div>
  )
}

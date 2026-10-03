import React from 'react'

export default function StrategySelector({ strategies, value, onChange, k, onKChange, disabled }) {
  const active = strategies.find((s) => s.key === value)

  return (
    <div className="card p-4">
      <label className="label" htmlFor="strategy">
        Scheduling strategy (executed in Python)
      </label>
      <select
        id="strategy"
        className="field"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      >
        {strategies.map((s) => (
          <option key={s.key} value={s.key}>
            {s.label}
          </option>
        ))}
      </select>

      {active && (
        <div className="mt-3 space-y-2 rounded-lg border border-slate-800 bg-slate-950/50 p-3">
          <p className="text-xs leading-relaxed text-slate-400">{active.blurb}</p>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-600">
              Priority function
            </p>
            <code className="mt-1 block break-words font-mono text-[11px] text-emerald-300">
              {active.formula}
            </code>
          </div>
          <div className="flex flex-wrap gap-2 pt-0.5">
            <span
              className={`chip ${
                active.dynamic
                  ? 'bg-violet-500/15 text-violet-300 ring-1 ring-violet-500/30'
                  : 'bg-slate-700/40 text-slate-400 ring-1 ring-slate-600/40'
              }`}
            >
              {active.dynamic ? 'Dynamic · rescored every tick' : 'Static · scored once'}
            </span>
            <span className="chip bg-slate-700/40 text-slate-400 ring-1 ring-slate-600/40">
              heapq min-heap
            </span>
          </div>
        </div>
      )}

      {value === 'greedy_min_delay' && (
        <div className="mt-3 border-t border-slate-800 pt-3">
          <div className="flex items-center justify-between">
            <label className="label !mb-0" htmlFor="kparam">
              Look-ahead&nbsp;<span className="font-mono text-emerald-300">K</span>
            </label>
            <span className="font-mono text-sm text-amber-300">{Number(k).toFixed(1)}</span>
          </div>
          <input
            id="kparam"
            type="range"
            min="0.3"
            max="6"
            step="0.1"
            value={k}
            onChange={(e) => onKChange(Number(e.target.value))}
            disabled={disabled}
          />
          <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
            Low&nbsp;K → aggressive, dominated by the urgency&nbsp;/&nbsp;prep-time ratio.
            High&nbsp;K → gentler deadline discount, behaves more like Earliest-Deadline-First.
          </p>
        </div>
      )}
    </div>
  )
}

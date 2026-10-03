import React from 'react'
import { statusStyle, URGENCY_STYLES } from '../helpers.js'

/** Evenly spaced minute ticks for the axis. */
function ticks(makespan) {
  if (makespan <= 0) return [0]
  const target = 8
  const raw = makespan / target
  const niceStep = [1, 2, 5, 10, 15, 20, 30, 60, 120].find((s) => s >= raw) || 120
  const out = []
  for (let t = 0; t <= makespan; t += niceStep) out.push(t)
  if (out[out.length - 1] !== makespan) out.push(makespan)
  return out
}

export default function Timeline({ timeline, metrics }) {
  if (!timeline || timeline.length === 0) return null
  const makespan = Math.max(metrics?.makespan || 0, ...timeline.map((s) => s.completion_time))
  const axis = ticks(makespan)
  const pct = (v) => `${(v / makespan) * 100}%`

  return (
    <div className="card">
      <div className="card-head">
        <div>
          <h2 className="text-sm font-bold text-slate-100">Cooking Timeline</h2>
          <p className="text-xs text-slate-500">
            One station · non-preemptive · clock starts at t=0 · total {makespan} min
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-[11px] text-slate-400">
          {Object.entries({
            on_time: 'On time',
            slight_delay: '≤ 5 min late',
            delayed: 'Delayed',
          }).map(([k, label]) => (
            <span key={k} className="inline-flex items-center gap-1.5">
              <span className={`h-2.5 w-2.5 rounded-sm ${statusStyle(k).bar}`} />
              {label}
            </span>
          ))}
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-0.5 bg-slate-300" />
            Deadline marker
          </span>
        </div>
      </div>

      {/* ---- Gantt ---- */}
      <div className="overflow-x-auto px-4 pb-1 pt-3">
        <div className="min-w-[620px]">
          {/* axis */}
          <div className="mb-1 flex">
            <div className="w-44 shrink-0" />
            <div className="relative h-4 flex-1">
              {axis.map((t, i) => (
                <span
                  key={i}
                  className="absolute -translate-x-1/2 text-[10px] tabular-nums text-slate-600"
                  style={{ left: pct(t) }}
                >
                  {t}
                </span>
              ))}
            </div>
          </div>

          {/* rows */}
          <div className="space-y-1.5">
            {timeline.map((slot) => {
              const st = statusStyle(slot.status)
              const width = (slot.prep_time / makespan) * 100
              const left = (slot.start_time / makespan) * 100
              const deadlinePct = Math.min(100, (slot.promised_time / makespan) * 100)
              const late = slot.delay > 0
              return (
                <div key={slot.id} className="flex items-center">
                  <div className="w-44 shrink-0 pr-3">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-[10px] text-slate-600">
                        {String(slot.position).padStart(2, '0')}
                      </span>
                      <span className="truncate text-xs font-medium text-slate-200" title={slot.name}>
                        {slot.name}
                      </span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-1 pl-6">
                      <span className={`chip !px-1.5 !py-0 !text-[9px] ${URGENCY_STYLES[slot.urgency]}`}>
                        U{slot.urgency}
                      </span>
                      <span className="font-mono text-[9px] text-slate-600">
                        {slot.prep_time}m
                      </span>
                    </div>
                  </div>

                  <div className="relative h-9 flex-1 rounded bg-slate-950/60">
                    {/* grid lines */}
                    {axis.map((t, i) => (
                      <span
                        key={i}
                        className="absolute top-0 h-full w-px bg-slate-800/60"
                        style={{ left: pct(t) }}
                      />
                    ))}

                    {/* the cooking slot */}
                    <div
                      className={`absolute top-1.5 flex h-6 items-center rounded ${st.bar} shadow`}
                      style={{ left: pct(slot.start_time), width: `${width}%`, minWidth: '6px' }}
                      title={`${slot.name}: ${slot.start_time} → ${slot.completion_time} min`}
                    >
                      <span className="truncate px-1.5 text-[10px] font-bold text-slate-950">
                        {slot.start_time}–{slot.completion_time}
                      </span>
                    </div>

                    {/* delay tail: from promised deadline to actual completion */}
                    {late && (
                      <div
                        className="absolute top-1.5 h-6 rounded-r border border-l-0 border-dashed border-rose-400/60 bg-rose-500/10"
                        style={{
                          left: pct(Math.min(slot.promised_time, slot.completion_time)),
                          width: `${Math.min(100 - deadlinePct, (slot.delay / makespan) * 100)}%`,
                        }}
                        title={`${slot.delay} min late`}
                      />
                    )}

                    {/* deadline marker */}
                    <span
                      className="absolute top-0 h-full w-0.5 bg-slate-300/70"
                      style={{ left: `${deadlinePct}%` }}
                      title={`Promised by ${slot.promised_time} min`}
                    />
                  </div>

                  <div className="w-24 shrink-0 pl-3 text-right">
                    <span className={`chip ${st.chip}`}>
                      {late ? `+${slot.delay}m` : 'on time'}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* ---- table ---- */}
      <div className="mt-3 overflow-x-auto border-t border-slate-800">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-900/80 text-[10px] uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-4 py-2 font-semibold">Order</th>
              <th className="px-3 py-2 font-semibold">Start</th>
              <th className="px-3 py-2 font-semibold">Finish</th>
              <th className="px-3 py-2 font-semibold">Promised</th>
              <th className="px-3 py-2 font-semibold">Delay</th>
              <th className="px-4 py-2 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {timeline.map((s) => {
              const st = statusStyle(s.status)
              return (
                <tr key={s.id} className="hover:bg-slate-800/30">
                  <td className="px-4 py-1.5 font-medium text-slate-200">{s.name}</td>
                  <td className="px-3 py-1.5 font-mono tabular-nums text-slate-400">{s.start_time}</td>
                  <td className="px-3 py-1.5 font-mono tabular-nums text-slate-400">
                    {s.completion_time}
                  </td>
                  <td className="px-3 py-1.5 font-mono tabular-nums text-slate-400">
                    {s.promised_time}
                  </td>
                  <td className="px-3 py-1.5 font-mono tabular-nums text-slate-300">{s.delay}</td>
                  <td className="px-4 py-1.5">
                    <span className={`chip ${st.chip}`}>{st.label}</span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

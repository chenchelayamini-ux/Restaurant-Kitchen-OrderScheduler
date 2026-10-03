import React, { useState } from 'react'
import { fmt } from '../helpers.js'

const Num = ({ children, className = '' }) => (
  <span className={`font-mono tabular-nums ${className}`}>{children}</span>
)

function BreakdownRow({ c, isChosen }) {
  const b = c.breakdown || {}
  return (
    <tr
      className={
        isChosen
          ? 'bg-amber-500/10 text-slate-100'
          : 'text-slate-400 hover:bg-slate-800/30'
      }
    >
      <td className="px-2 py-1 text-center">
        {isChosen ? <span className="text-amber-300">▶</span> : <span className="text-slate-700">{c.rank}</span>}
      </td>
      <td className="px-2 py-1 font-medium">
        #{c.id} {c.name}
      </td>
      <td className="px-2 py-1 text-center">{c.urgency}</td>
      <td className="px-2 py-1 text-center">{c.prep_time}</td>
      <td className="px-2 py-1 text-center">{c.promised_time}</td>
      <td className="px-2 py-1 text-center">
        <Num className={b.at_risk ? 'text-rose-300' : 'text-slate-400'}>{fmt(b.slack, 0)}</Num>
      </td>
      <td className="px-2 py-1 text-center">
        <Num className="text-sky-300">{fmt(b.ratio, 3)}</Num>
      </td>
      <td className="px-2 py-1 text-center">
        <Num className="text-violet-300">{fmt(b.deadline_factor, 3)}</Num>
      </td>
      <td className="px-2 py-1 text-right">
        <Num className={isChosen ? 'font-bold text-amber-300' : 'text-slate-200'}>
          {fmt(b.score, 4)}
        </Num>
      </td>
    </tr>
  )
}

function Step({ step, isOpen, onToggle }) {
  const a = step.arithmetic
  const chosen = step.chosen
  const delayed = a.delay > 0

  return (
    <div className="overflow-hidden rounded-lg border border-slate-800 bg-slate-950/40">
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-3 py-2 text-left transition hover:bg-slate-800/40"
      >
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-slate-800 font-mono text-[11px] font-bold text-amber-300">
          {step.step}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-semibold text-slate-200">
            <span className="text-slate-500">t={step.time_now} →</span> #{chosen.id} {chosen.name}
          </span>
          <span className="block font-mono text-[10px] text-slate-500">
            start {a.start} + prep {a.prep_time} = finish {a.completion} · promised {a.promised_time}
            {delayed ? ` · ${a.delay} min late` : ' · on time'}
          </span>
        </span>
        <span
          className={`chip shrink-0 ${
            delayed ? 'bg-rose-500/15 text-rose-300' : 'bg-emerald-500/15 text-emerald-300'
          }`}
        >
          {delayed ? `+${a.delay}m` : 'on time'}
        </span>
        <span className="shrink-0 text-slate-600">{isOpen ? '▾' : '▸'}</span>
      </button>

      {isOpen && (
        <div className="animate-fade-in space-y-3 border-t border-slate-800 px-3 py-3">
          {/* rationale */}
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-2.5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-amber-500/80">
              Greedy choice rationale
            </p>
            <p className="mt-1 text-xs leading-relaxed text-slate-200">{step.rationale}</p>
          </div>

          {/* arithmetic */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-600">
              Arithmetic
            </p>
            <p className="mt-1 font-mono text-[11px] text-slate-400">{a.formula}</p>
            <p className="mt-1 font-mono text-[11px] text-emerald-300">
              {a.start} + {a.prep_time} = {a.completion} → max(0, {a.completion} − {a.promised_time})
              = {a.delay}
            </p>
          </div>

          {/* queue event */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-600">
              Queue state change
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
              {step.queue_event.note}
            </p>
            <p className="mt-1 font-mono text-[10px] text-slate-600">
              heap generation {step.queue_event.generation} · {step.queue_size_before} →{' '}
              {step.queue_size_after} live ticket(s) · {step.heap_entries_physical} physical heap
              entries (lazy-deletion: stale entries are skipped, not removed)
            </p>
            {Array.isArray(step.queue_state) && step.queue_state.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                <span className="text-[10px] text-slate-600">Queue after pop:</span>
                {step.queue_state.map((q) => (
                  <span
                    key={q.id}
                    className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[10px] text-slate-400"
                  >
                    #{q.id} {q.name}
                  </span>
                ))}
                {step.queue_state.length === 0 && (
                  <span className="text-[10px] text-slate-600">empty</span>
                )}
              </div>
            )}
          </div>

          {/* candidates */}
          {step.candidates?.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-600">
                Candidate scores at t={step.time_now}
                {step.candidates.length < step.queue_size_before &&
                  ` (top ${step.candidates.length} of ${step.queue_size_before})`}
              </p>
              <div className="mt-1 overflow-x-auto rounded border border-slate-800">
                <table className="w-full text-[11px]">
                  <thead className="bg-slate-900/80 text-[9px] uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="px-2 py-1" />
                      <th className="px-2 py-1 text-left font-semibold">Order</th>
                      <th className="px-2 py-1 font-semibold">U</th>
                      <th className="px-2 py-1 font-semibold">p</th>
                      <th className="px-2 py-1 font-semibold">d</th>
                      <th className="px-2 py-1 font-semibold">slack</th>
                      <th className="px-2 py-1 font-semibold">u/p</th>
                      <th className="px-2 py-1 font-semibold">exp</th>
                      <th className="px-2 py-1 text-right font-semibold">score</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {step.candidates.map((c) => (
                      <BreakdownRow key={c.id} c={c} isChosen={c.id === step.chosen.id} />
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-1 text-[10px] text-slate-600">
                u/p = urgency&nbsp;/&nbsp;prep_time · exp = exp(−max(0,slack)/(K×avg_prep)) · score =
                u/p × exp — higher wins.
              </p>
            </div>
          )}

          {/* running metrics */}
          <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-slate-800 pt-2 font-mono text-[10px] text-slate-500">
            <span>
              cumulative delay <Num className="text-slate-300">{step.metrics_so_far.total_delay}m</Num>
            </span>
            <span>
              on-time{' '}
              <Num className="text-slate-300">
                {step.metrics_so_far.on_time_count}/{step.metrics_so_far.total_orders}
              </Num>
            </span>
            <span>
              cost <Num className="text-slate-300">{fmt(step.metrics_so_far.total_cost, 0)}</Num>
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

export default function DecisionTrace({ decisionLog, strategy }) {
  const [open, setOpen] = useState(() => new Set([1]))

  if (!decisionLog || decisionLog.length === 0) return null

  const toggle = (i) =>
    setOpen((prev) => {
      const next = new Set(prev)
      next.has(i) ? next.delete(i) : next.add(i)
      return next
    })

  const allOpen = open.size >= decisionLog.length

  return (
    <div className="card">
      <div className="card-head">
        <div>
          <h2 className="text-sm font-bold text-slate-100">Algorithm Decision Trace</h2>
          <p className="text-xs text-slate-500">
            {decisionLog.length} greedy step(s) recorded by the Python engine
            {strategy?.dynamic ? ' · priority rescored at every tick' : ' · static priority'}
          </p>
        </div>
        <button
          className="btn-ghost !px-2 !py-1 !text-xs"
          onClick={() =>
            setOpen(allOpen ? new Set() : new Set(decisionLog.map((s) => s.step)))
          }
        >
          {allOpen ? 'Collapse all' : 'Expand all'}
        </button>
      </div>

      <div className="max-h-[32rem] space-y-2 overflow-y-auto p-3">
        {decisionLog.map((step) => (
          <Step
            key={step.step}
            step={step}
            isOpen={open.has(step.step)}
            onToggle={() => toggle(step.step)}
          />
        ))}
      </div>

      <div className="border-t border-slate-800 px-3 py-2">
        <p className="text-[10px] leading-relaxed text-slate-600">
          Each step is one <span className="font-mono text-slate-500">heappop()</span> from the
          min-heap. Dynamic strategies invalidate the heap and re-push every remaining ticket with a
          score recomputed against the current clock, so the queue genuinely changes between steps.
        </p>
      </div>
    </div>
  )
}

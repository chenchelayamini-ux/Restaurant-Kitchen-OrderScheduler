import React from 'react'
import { URGENCY_STYLES, URGENCY_LABELS } from '../helpers.js'

const UrgencyDots = ({ level }) => (
  <span className="inline-flex items-center gap-1" title={`Urgency ${level} · ${URGENCY_LABELS[level]}`}>
    <span className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          className={`h-1.5 w-1.5 rounded-full ${i <= level ? 'bg-amber-400' : 'bg-slate-700'}`}
        />
      ))}
    </span>
    <span className={`chip ${URGENCY_STYLES[level]}`}>{level}</span>
  </span>
)

export default function OrderTable({ orders, onEdit, onDelete, onClear, onLoadSample }) {
  return (
    <div className="card overflow-hidden">
      <div className="card-head">
        <div>
          <h2 className="text-sm font-bold text-slate-100">Order Queue</h2>
          <p className="text-xs text-slate-500">{orders.length} ticket(s) waiting</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-ghost !px-2 !py-1 !text-xs" onClick={onLoadSample}>
            Load sample
          </button>
          <button
            className="btn-danger !px-2 !py-1 !text-xs"
            onClick={onClear}
            disabled={orders.length === 0}
          >
            Clear
          </button>
        </div>
      </div>

      <div className="max-h-[22rem] overflow-y-auto">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 bg-slate-900/95 text-[11px] uppercase tracking-wider text-slate-500 backdrop-blur">
            <tr>
              <th className="px-3 py-2 font-semibold">#</th>
              <th className="px-3 py-2 font-semibold">Dish</th>
              <th className="px-3 py-2 font-semibold">Prep</th>
              <th className="px-3 py-2 font-semibold">Deadline</th>
              <th className="px-3 py-2 font-semibold">Urgency</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/80">
            {orders.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-sm text-slate-600">
                  No orders yet — add one on the left or load the sample data.
                </td>
              </tr>
            )}
            {orders.map((o, i) => (
              <tr key={o.id} className="group hover:bg-slate-800/40">
                <td className="px-3 py-2 font-mono text-xs text-slate-500">{i + 1}</td>
                <td className="px-3 py-2 font-medium text-slate-200">{o.name}</td>
                <td className="px-3 py-2 tabular-nums text-slate-400">{o.prep_time}m</td>
                <td className="px-3 py-2 tabular-nums text-slate-400">{o.promised_time}m</td>
                <td className="px-3 py-2">
                  <UrgencyDots level={o.urgency} />
                </td>
                <td className="px-3 py-2 text-right">
                  <div className="flex justify-end gap-1 opacity-0 transition group-hover:opacity-100">
                    <button
                      className="rounded px-2 py-1 text-xs text-sky-300 hover:bg-sky-500/10"
                      onClick={() => onEdit(o)}
                    >
                      Edit
                    </button>
                    <button
                      className="rounded px-2 py-1 text-xs text-rose-300 hover:bg-rose-500/10"
                      onClick={() => onDelete(o.id)}
                    >
                      Del
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/** Shared formatting + colour helpers. */

export const STATUS_STYLES = {
  on_time: {
    label: 'On Time',
    chip: 'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30',
    bar: 'bg-gradient-to-r from-emerald-500 to-emerald-400',
    dot: 'bg-emerald-400',
  },
  slight_delay: {
    label: 'Slight Delay',
    chip: 'bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30',
    bar: 'bg-gradient-to-r from-amber-500 to-amber-400',
    dot: 'bg-amber-400',
  },
  delayed: {
    label: 'Delayed',
    chip: 'bg-rose-500/15 text-rose-300 ring-1 ring-rose-500/30',
    bar: 'bg-gradient-to-r from-rose-600 to-rose-400',
    dot: 'bg-rose-400',
  },
}

export const statusStyle = (status) => STATUS_STYLES[status] || STATUS_STYLES.on_time

export const URGENCY_STYLES = {
  1: 'bg-slate-700 text-slate-300',
  2: 'bg-sky-500/20 text-sky-300',
  3: 'bg-indigo-500/20 text-indigo-300',
  4: 'bg-orange-500/20 text-orange-300',
  5: 'bg-rose-500/20 text-rose-300',
}

export const URGENCY_LABELS = {
  1: 'Low',
  2: 'Normal',
  3: 'Medium',
  4: 'High',
  5: 'VIP',
}

/** Fixed-decimal formatter that never renders "-0.00". */
export const fmt = (n, digits = 2) => {
  const v = Number(n)
  if (!Number.isFinite(v)) return '—'
  return v.toFixed(digits).replace(/\.0+$/, '')
}

export const mins = (n) => `${n} min`

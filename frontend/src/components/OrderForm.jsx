import React, { useState } from 'react'
import { URGENCY_LABELS } from '../helpers.js'

const BLANK = { name: '', prep_time: 10, urgency: 3, promised_time: 20 }

/**
 * Add / edit a kitchen ticket.
 * `editing` is the order currently being edited (or null => "create" mode).
 */
export default function OrderForm({ onSubmit, onCancel, editing }) {
  const [form, setForm] = useState(
    editing ? { ...editing } : { ...BLANK },
  )

  // Re-seed the form whenever the row being edited changes.
  const [syncedId, setSyncedId] = useState(editing ? editing.id : null)
  if ((editing ? editing.id : null) !== syncedId) {
    setSyncedId(editing ? editing.id : null)
    setForm(editing ? { ...editing } : { ...BLANK })
  }

  const set = (key) => (e) =>
    setForm((f) => ({ ...f, [key]: key === 'name' ? e.target.value : Number(e.target.value) }))

  const submit = (e) => {
    e.preventDefault()
    if (!form.name.trim()) return
    onSubmit({
      name: form.name.trim(),
      prep_time: Math.max(1, Number(form.prep_time) || 1),
      urgency: Math.min(5, Math.max(1, Number(form.urgency) || 3)),
      promised_time: Math.max(0, Number(form.promised_time) || 0),
    })
    if (!editing) setForm({ ...BLANK })
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <label className="label" htmlFor="of-name">
          Dish / Ticket name
        </label>
        <input
          id="of-name"
          className="field"
          placeholder="e.g. Butter Chicken"
          value={form.name}
          onChange={set('name')}
          required
        />
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="label" htmlFor="of-prep">
            Prep (min)
          </label>
          <input
            id="of-prep"
            type="number"
            min="1"
            max="240"
            className="field"
            value={form.prep_time}
            onChange={set('prep_time')}
          />
        </div>
        <div>
          <label className="label" htmlFor="of-promise">
            Promised by (min)
          </label>
          <input
            id="of-promise"
            type="number"
            min="0"
            max="600"
            className="field"
            value={form.promised_time}
            onChange={set('promised_time')}
          />
        </div>
        <div>
          <label className="label" htmlFor="of-urg">
            Urgency (1–5)
          </label>
          <input
            id="of-urg"
            type="number"
            min="1"
            max="5"
            className="field"
            value={form.urgency}
            onChange={set('urgency')}
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="range"
          min="1"
          max="5"
          step="1"
          value={form.urgency}
          onChange={set('urgency')}
          aria-label="Urgency slider"
        />
        <span className="w-16 shrink-0 text-right text-xs font-semibold text-slate-400">
          {form.urgency} · {URGENCY_LABELS[form.urgency]}
        </span>
      </div>

      <div className="flex gap-2 pt-1">
        <button type="submit" className="btn-primary flex-1">
          {editing ? 'Save changes' : '+ Add order'}
        </button>
        {editing && (
          <button type="button" className="btn-ghost" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </form>
  )
}

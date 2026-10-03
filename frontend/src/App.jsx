import React, { useCallback, useEffect, useMemo, useState } from 'react'
import OrderForm from './components/OrderForm.jsx'
import OrderTable from './components/OrderTable.jsx'
import StrategySelector from './components/StrategySelector.jsx'
import MetricsBar from './components/MetricsBar.jsx'
import Timeline from './components/Timeline.jsx'
import DecisionTrace from './components/DecisionTrace.jsx'
import ComparePanel from './components/ComparePanel.jsx'
import { fetchSampleData, fetchStrategies, runCompare, runSchedule } from './api.js'

const FALLBACK_STRATEGIES = [
  {
    key: 'greedy_min_delay',
    label: 'Greedy Min-Delay Heuristic (ATC)',
    blurb: 'Dynamic composite score recombined at every tick.',
    formula: 'score = (urgency / prep_time) x exp(-max(0, slack) / (K x avg_prep))',
    dynamic: true,
  },
  { key: 'edf', label: 'Earliest Deadline First (EDF)', blurb: '', formula: '', dynamic: false },
  { key: 'huf', label: 'Highest Urgency First', blurb: '', formula: '', dynamic: false },
  { key: 'spt', label: 'Shortest Prep Time First', blurb: '', formula: '', dynamic: false },
  { key: 'fifo', label: 'First In, First Out (baseline)', blurb: '', formula: '', dynamic: false },
]

let localId = 1000
const nextId = () => ++localId

export default function App() {
  const [orders, setOrders] = useState([])
  const [editingId, setEditingId] = useState(null)
  const [strategies, setStrategies] = useState(FALLBACK_STRATEGIES)
  const [strategy, setStrategy] = useState('greedy_min_delay')
  const [k, setK] = useState(1.5)

  const [result, setResult] = useState(null)
  const [comparison, setComparison] = useState(null)
  const [loading, setLoading] = useState(false)
  const [comparing, setComparing] = useState(false)
  const [error, setError] = useState('')
  const [booted, setBooted] = useState(false)
  const [ranSig, setRanSig] = useState(null)

  // ---------------------------------------------------------------- boot
  useEffect(() => {
    ;(async () => {
      try {
        const [s, sample] = await Promise.all([fetchStrategies(), fetchSampleData()])
        if (s.strategies?.length) setStrategies(s.strategies)
        if (s.default) setStrategy(s.default)
        const seeded = sample.orders.map((o) => ({ ...o }))
        setOrders(seeded)
        localId = Math.max(1000, ...seeded.map((o) => Number(o.id) || 0))
        setBooted(true)
      } catch (err) {
        setError(err.message)
        setBooted(true)
      }
    })()
  }, [])

  const editing = useMemo(
    () => orders.find((o) => o.id === editingId) || null,
    [orders, editingId],
  )

  // ------------------------------------------------------------ actions
  const handleSubmit = (data) => {
    setError('')
    if (editingId !== null) {
      setOrders((prev) => prev.map((o) => (o.id === editingId ? { ...o, ...data } : o)))
      setEditingId(null)
    } else {
      setOrders((prev) => [...prev, { id: nextId(), ...data }])
    }
  }

  const handleDelete = (id) => {
    setOrders((prev) => prev.filter((o) => o.id !== id))
    if (editingId === id) setEditingId(null)
  }

  const handleClear = () => {
    setOrders([])
    setResult(null)
    setComparison(null)
    setEditingId(null)
  }

  const handleLoadSample = async () => {
    try {
      const sample = await fetchSampleData()
      const seeded = sample.orders.map((o) => ({ ...o }))
      setOrders(seeded)
      localId = Math.max(1000, ...seeded.map((o) => Number(o.id) || 0))
      setEditingId(null)
      setError('')
    } catch (err) {
      setError(err.message)
    }
  }

  // Fingerprint of everything that feeds the algorithm. Used to warn the user
  // when the on-screen results no longer match the current inputs.
  const sig = useMemo(() => JSON.stringify({ orders, strategy, k }), [orders, strategy, k])
  const stale = Boolean(result) && ranSig !== sig

  const handleSchedule = useCallback(async () => {
    if (orders.length === 0) {
      setError('Add at least one order first.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const data = await runSchedule(orders, strategy, k)
      setResult(data)
      setRanSig(JSON.stringify({ orders, strategy, k }))
      setComparison(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [orders, strategy, k])

  const handleCompare = async () => {
    if (orders.length === 0) {
      setError('Add at least one order first.')
      return
    }
    setComparing(true)
    setError('')
    try {
      setComparison(await runCompare(orders))
    } catch (err) {
      setError(err.message)
    } finally {
      setComparing(false)
    }
  }

  // Re-run automatically whenever the strategy or K changes (if we already
  // have a result on screen), so the dashboard always matches the selector.
  useEffect(() => {
    if (result && orders.length) handleSchedule()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [strategy, k])

  // ------------------------------------------------------------- render
  return (
    <div className="min-h-full bg-slate-950">
      {/* header */}
      <header className="sticky top-0 z-20 border-b border-slate-800 bg-slate-950/85 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-amber-500 text-lg">
              🍳
            </span>
            <div>
              <h1 className="text-base font-bold leading-tight text-slate-50">
                Restaurant Kitchen Order Scheduler
              </h1>
              <p className="text-[11px] text-slate-500">
                Problem 81 · heapq priority queue &amp; greedy job sequencing · Flask + React
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              className="btn-ghost !py-1.5 !text-xs"
              onClick={handleCompare}
              disabled={comparing || orders.length === 0}
            >
              {comparing ? 'Comparing…' : 'Compare all strategies'}
            </button>
            <button
              className="btn-primary !py-1.5"
              onClick={handleSchedule}
              disabled={loading || orders.length === 0}
            >
              {loading ? 'Scheduling…' : '▶ Run scheduler'}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-4 px-4 py-5">
        {error && (
          <div className="rounded-lg border border-rose-800/60 bg-rose-950/40 px-4 py-3">
            <p className="whitespace-pre-wrap text-xs text-rose-200">{error}</p>
          </div>
        )}

        {/* top row: editor + queue */}
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-4">
            <div className="card p-4">
              <h2 className="mb-3 text-sm font-bold text-slate-100">
                {editing ? 'Edit order' : 'Add an order'}
              </h2>
              <OrderForm
                editing={editing}
                onSubmit={handleSubmit}
                onCancel={() => setEditingId(null)}
              />
            </div>
            <StrategySelector
              strategies={strategies}
              value={strategy}
              onChange={setStrategy}
              k={k}
              onKChange={setK}
              disabled={loading}
            />
          </div>

          <div className="lg:col-span-2">
            <OrderTable
              orders={orders}
              onEdit={(o) => setEditingId(o.id)}
              onDelete={handleDelete}
              onClear={handleClear}
              onLoadSample={handleLoadSample}
            />
          </div>
        </div>

        {!result && !comparison && (
          <div className="card px-6 py-12 text-center">
            <p className="text-sm text-slate-400">
              {booted && orders.length === 0
                ? 'Add some orders (or load the sample data), then run the scheduler.'
                : 'Press “Run scheduler” to compute the kitchen timeline and the decision trace.'}
            </p>
          </div>
        )}

        {comparison && (
          <ComparePanel comparison={comparison} onClose={() => setComparison(null)} />
        )}

        {result && (
          <div className="animate-fade-in space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-bold text-slate-100">
                Results · <span className="text-amber-300">{result.strategy.label}</span>
                {result.strategy.dynamic && (
                  <span className="ml-2 font-mono text-[10px] text-slate-500">
                    K = {result.lookahead_k}
                  </span>
                )}
              </h2>
              <p className="font-mono text-[11px] text-slate-500">{result.strategy.formula}</p>
            </div>

            {stale && (
              <div className="rounded-lg border border-amber-700/50 bg-amber-500/10 px-4 py-2 text-xs text-amber-200">
                Inputs changed since this run — press <b>Run scheduler</b> to refresh the timeline and
                trace.
              </div>
            )}

            <MetricsBar metrics={result.metrics} />
            <Timeline timeline={result.timeline} metrics={result.metrics} />
            <DecisionTrace decisionLog={result.decision_log} strategy={result.strategy} />
          </div>
        )}
      </main>

      <footer className="border-t border-slate-800 px-4 py-5">
        <p className="mx-auto max-w-7xl text-[11px] leading-relaxed text-slate-600">
          Single-station, non-preemptive model. All tickets are available at t=0. Greedy sequencing
          is a heuristic: the audit trail exists so a human chef can verify every local choice.
        </p>
      </footer>
    </div>
  )
}

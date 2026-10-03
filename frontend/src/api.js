/**
 * Tiny fetch wrapper for the Flask API.
 *
 * Works in both modes without any config:
 *   - `npm run dev`  -> Vite proxies /api to http://localhost:5000
 *   - `python app.py`-> Flask serves the built UI and /api from one origin
 */

const BASE = import.meta.env.VITE_API_BASE || '/api'

async function request(path, options = {}) {
  let res
  try {
    res = await fetch(`${BASE}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    })
  } catch (err) {
    throw new Error(
      `Cannot reach the Flask server at ${BASE}. ` +
        `Start it with:  python app.py  (or, in dev, keep both processes running).`,
    )
  }

  let body = null
  try {
    body = await res.json()
  } catch {
    throw new Error(`Server returned a non-JSON response (HTTP ${res.status}).`)
  }

  if (!res.ok || body.ok === false) {
    const detail = body?.errors?.length ? `\n- ${body.errors.join('\n- ')}` : ''
    throw new Error(`${body?.error || `HTTP ${res.status}`}${detail}`)
  }
  return body
}

export const fetchSampleData = () => request('/sample-data')

export const fetchStrategies = () => request('/strategies')

export const runSchedule = (orders, strategy, k) =>
  request('/schedule', {
    method: 'POST',
    body: JSON.stringify({ orders, strategy, k }),
  })

export const runCompare = (orders) =>
  request('/compare', { method: 'POST', body: JSON.stringify({ orders }) })

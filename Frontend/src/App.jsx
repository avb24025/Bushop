import React, { useState, useRef } from 'react'
import './App.css'

 function App() {
  const [source, setSource] = useState('')
  const [destination, setDestination] = useState('')
  const [date, setDate] = useState('')
  const [rawDate, setRawDate] = useState('')
  const dateRef = useRef(null)
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState(null)
  const [error, setError] = useState(null)

  function openDatePicker() {
    if (!dateRef.current) return
    if (typeof dateRef.current.showPicker === 'function') {
      dateRef.current.showPicker()
    } else {
      dateRef.current.focus()
      dateRef.current.click()
    }
  }

  function formatIsoToLong(iso) {
    if (!iso) return ''
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return ''
    const day = d.getDate()
    const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"]
    const month = monthNames[d.getMonth()]
    const year = d.getFullYear()
    return `${day} ${month} ${year}`
  }

  function classify(item) {
    if (!item) return 'other'
    if (item.seatsAvailable || item.type) return 'ixigo'
    if (item.source && /abhi/i.test(item.source)) return 'abhibus'
    if (item.source && /red/i.test(item.source)) return 'redbus'
    return (item.source || '').toString().toLowerCase() || 'other'
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)

    // Validate required fields
    if (!source.trim()) {
      setError('Please enter a source city')
      return
    }
    if (!destination.trim()) {
      setError('Please enter a destination city')
      return
    }
    if (!date.trim()) {
      setError('Please select a travel date')
      return
    }

    // Validate date is >= today
    const selectedDate = new Date(rawDate)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    if (selectedDate < today) {
      setError('Please select a date today or in the future')
      return
    }

    setLoading(true)
    setResults(null)

    try {
      const backendURL =  'http://localhost:5000'
      const res = await fetch(`${backendURL}/api/bus`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source, destination, date })
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()

      let items = []
      if (Array.isArray(data)) {
        items = data
      } else if (data && Array.isArray(data.combined)) {
        items = data.combined
      } else if (data && data.data && typeof data.data === 'object') {
        items = Object.values(data.data).flat().filter(Boolean)
      } else {
        items = []
      }

      const normalized = (items || []).map(it => {
        const platform = classify(it)
        const price = Number(it.price ?? it.price) || 0
        return { ...it, platform, price }
      })

      const ixigo = normalized.filter(i => i.platform === 'ixigo').sort((a,b)=>a.price-b.price)
      const abhibus = normalized.filter(i => i.platform === 'abhibus').sort((a,b)=>a.price-b.price)
      const redbus = normalized.filter(i => i.platform === 'redbus').sort((a,b)=>a.price-b.price)
      const others = normalized.filter(i => !['ixigo','abhibus','redbus'].includes(i.platform)).sort((a,b)=>a.price-b.price)

      setResults({ ixigo, abhibus, redbus, others })
    } catch (err) {
      setError(err.message || String(err))
    } finally {
      setLoading(false)
    }
  }

  function getPlatformURL(platform, bus) {
    const baseURL = {
      'ixigo': 'https://bus.ixigo.com/',
      'abhibus': 'https://www.abhibus.com/',
      'redbus': 'https://www.redbus.in/'
    }
    return baseURL[platform] || baseURL['ixigo']
  }

  function handleBusClick(platform) {
    const url = getPlatformURL(platform)
    window.open(url, '_blank')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 to-white flex items-center justify-center p-6">
      <div className="w-full max-w-4xl">
        <div className="bg-white rounded-t-2xl shadow-xl p-8 border-b-4 border-sky-500">
          <div className="flex items-center gap-3 mb-6">
            <div className="text-4xl font-bold text-sky-600">🚌</div>
            <h1 className="text-3xl font-bold text-gray-900">BusHop</h1>
          </div>
          <p className="text-gray-600 text-sm">Compare bus prices across multiple platforms • Book your perfect journey</p>
        </div>

        <div className="bg-white shadow-xl rounded-b-2xl p-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-6">Find Your Bus</h2>

          <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <input
              aria-label="source"
              required
              className="px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 bg-gray-50 hover:bg-white transition"
              placeholder="Source (e.g. Khed)"
              value={source}
              onChange={e => setSource(e.target.value)}
            />

            <input
              aria-label="destination"
              required
              className="px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 bg-gray-50 hover:bg-white transition"
              placeholder="Destination (e.g. Pune)"
              value={destination}
              onChange={e => setDestination(e.target.value)}
            />

            <div className="relative">
              <input
                aria-label="date-display"
                readOnly
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 bg-gray-50 hover:bg-white transition"
                placeholder="Date (e.g. 15 February 2026)"
                value={date}
                onClick={() => openDatePicker()}
              />
              <input
                ref={dateRef}
                type="date"
                className="absolute left-0 top-0 opacity-0 pointer-events-none"
                onChange={e => { setRawDate(e.target.value); setDate(formatIsoToLong(e.target.value)) }}
              />
              <button type="button" onClick={() => openDatePicker()} className="absolute right-3 top-1/2 -translate-y-1/2 text-sky-600 text-xl hover:text-sky-700 transition">📅</button>
            </div>
          </div>

          <div className="flex items-center gap-4 pt-2">
            <button
              type="submit"
              className="bg-sky-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-sky-700 transition disabled:opacity-60 shadow-md flex-1 md:flex-none"
              disabled={loading}
            >
              {loading ? 'Comparing prices from Ixigo, AbhiBus, and more...' : 'Search'}
            </button>

            <button
              type="button"
              className="px-5 py-3 border-2 border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition"
              onClick={() => { setSource('Khed'); setDestination('Pune'); setRawDate('2026-02-15'); setDate('15 February 2026') }}
            >
              Use Test Values
            </button>
          </div>
        </form>

          <div className="mt-8">
            {error && <div className="bg-red-50 border border-red-300 text-red-700 px-4 py-3 rounded-lg">Error: {error}</div>}

            {results && (results.ixigo?.length || results.abhibus?.length || results.redbus?.length) && (
              <div className="space-y-5">
                {['ixigo','abhibus','redbus','others'].map(platformKey => {
                  const list = results[platformKey] || []
                  if (!list.length) return null
                  const title = platformKey === 'ixigo' ? 'Ixigo' : platformKey === 'abhibus' ? 'AbhiBus' : platformKey === 'redbus' ? 'RedBus' : 'Other'
                  return (
                    <section key={platformKey} className="bg-gradient-to-br from-slate-50 to-slate-100 p-5 rounded-xl border border-slate-200">
                      <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-bold text-gray-900">{title} <span className="text-sm text-gray-500 font-normal">({list.length} buses)</span></h2>
                        <div className="text-sm text-gray-600">Sorted by price ↑</div>
                      </div>

                      <ul className="space-y-3">
                        {list.map((r, idx) => (
                          <li key={idx} onClick={() => handleBusClick(platformKey)} className="flex items-center justify-between p-4 bg-white rounded-lg shadow hover:shadow-md transition border border-gray-100 cursor-pointer hover:bg-sky-50">
                            <div>
                              <div className="font-bold text-gray-900">{r.operator || r.source || 'Unknown'}</div>
                              <div className="text-sm text-gray-600 mt-1">🕐 {r.departure} → {r.arrival} • ⏱️ {r.duration || 'N/A'}</div>
                              <div className="text-xs text-gray-500 mt-1">🚌 {r.busType || r.type || 'N/A'} • 💺 {r.seats || r.seatsAvailable || 'N/A'}</div>
                            </div>
                            <div className="text-right min-w-max ml-4">
                              <div className="text-2xl font-bold text-sky-600">₹{r.price}</div>
                              <div className="text-xs text-gray-500 mt-1">⭐ {r.rating ?? 'N/A'}</div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </section>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default App

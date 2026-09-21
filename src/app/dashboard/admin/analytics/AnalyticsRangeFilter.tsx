'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

const PRESETS = [
  { value: '7d', label: 'Letzte 7 Tage' },
  { value: '30d', label: 'Letzte 30 Tage' },
  { value: '90d', label: 'Letzte 90 Tage' },
  { value: 'month', label: 'Aktueller Monat' },
  { value: 'custom', label: 'Frei wählbar' },
] as const

/**
 * Phase 3.6H – reine Zeitraum-Auswahl-UI, analog zum bestehenden Muster in
 * src/app/dashboard/admin/seo/SeoFilters.tsx (Query-Parameter + router.push, kein eigener
 * State-Store). Der eigentliche Zeitraum wird ausschließlich serverseitig in
 * resolveAnalyticsDateRange() (src/lib/analytics-queries.ts) aufgelöst – dieses Formular liefert
 * nur die rohen Parameter, validiert/berechnet aber selbst nichts.
 */
export default function AnalyticsRangeFilter({
  initial,
}: {
  initial: { range: string; from?: string; to?: string }
}) {
  const router = useRouter()
  const [range, setRange] = useState(initial.range)
  const [from, setFrom] = useState(initial.from || '')
  const [to, setTo] = useState(initial.to || '')

  function apply(e: React.FormEvent) {
    e.preventDefault()
    const params = new URLSearchParams()
    params.set('range', range)
    if (range === 'custom') {
      if (from) params.set('from', from)
      if (to) params.set('to', to)
    }
    router.push(`/dashboard/admin/analytics?${params.toString()}`)
  }

  return (
    <form onSubmit={apply} className="flex flex-wrap gap-2 items-end mb-6">
      <div>
        <label className="block text-xs font-semibold text-slate-500 mb-1">Zeitraum</label>
        <select
          value={range}
          onChange={(e) => setRange(e.target.value)}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
        >
          {PRESETS.map((p) => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </select>
      </div>
      {range === 'custom' && (
        <>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Von</label>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Bis</label>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
        </>
      )}
      <button type="submit" className="bg-[#17202a] hover:bg-slate-800 text-white text-sm font-bold px-4 py-2 rounded-lg">
        Anwenden
      </button>
    </form>
  )
}

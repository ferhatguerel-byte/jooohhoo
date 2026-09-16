'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { GEWERKE } from '@/lib/gewerke'
import { RADIUS_OPTIONS } from '@/lib/plz-geo'

export default function JobFilters({
  initialGewerke,
  initialPlz,
  initialRadius,
}: {
  initialGewerke: string[]
  initialPlz: string
  initialRadius: string
}) {
  const router = useRouter()
  const [gewerke, setGewerke] = useState<string[]>(initialGewerke)
  const [plz, setPlz] = useState(initialPlz)
  const [radius, setRadius] = useState(initialRadius)

  function toggleGewerk(g: string) {
    setGewerke((prev) => (prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]))
  }

  function apply() {
    const params = new URLSearchParams()
    if (gewerke.length > 0) params.set('gewerke', gewerke.join(','))
    if (plz) params.set('plz', plz)
    if (plz && radius) params.set('radius', radius)
    router.push(`/dashboard/jobs?${params.toString()}`)
  }

  function reset() {
    setGewerke([])
    setPlz('')
    setRadius('')
    router.push('/dashboard/jobs')
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 mb-8">
      <div className="mb-4">
        <p className="text-sm font-semibold text-slate-700 mb-2">Gewerke (Mehrfachauswahl)</p>
        <div className="flex flex-wrap gap-2">
          {GEWERKE.map((g) => (
            <button
              key={g}
              onClick={() => toggleGewerk(g)}
              className={`px-3 py-1.5 rounded-full text-sm border transition ${
                gewerke.includes(g) ? 'bg-[#17202a] border-[#17202a] text-white' : 'border-slate-300 text-slate-600'
              }`}
            >
              {g}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label htmlFor="filter-plz" className="block text-sm font-semibold text-slate-700 mb-1">Deine PLZ</label>
          <input
            id="filter-plz"
            value={plz}
            onChange={(e) => setPlz(e.target.value)}
            placeholder="z. B. 10115"
            className="w-32 border border-slate-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label htmlFor="filter-radius" className="block text-sm font-semibold text-slate-700 mb-1">Umkreis</label>
          <select
            id="filter-radius"
            value={radius}
            onChange={(e) => setRadius(e.target.value)}
            disabled={!plz}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white disabled:bg-slate-50 disabled:text-slate-400"
          >
            <option value="">Ganz Deutschland</option>
            {RADIUS_OPTIONS.map((r) => (
              <option key={r} value={r}>bis {r} km</option>
            ))}
          </select>
        </div>
        <button onClick={apply} className="bg-accent hover:bg-accent-hover text-white font-bold text-sm py-2 px-5 rounded-lg">
          Filtern
        </button>
        <button onClick={reset} className="text-slate-500 text-sm font-medium">Zurücksetzen</button>
      </div>
      {plz && radius && (
        <p className="text-xs text-slate-400 mt-3">
          Entfernung basiert auf der Postleitregion (erste 2 Ziffern der PLZ) und ist eine grobe Näherung, keine exakte Adress-Entfernung.
        </p>
      )}
    </div>
  )
}

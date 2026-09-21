'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

const STATUS_OPTIONS = ['DRAFT', 'REVIEW', 'INDEXABLE', 'NOINDEX'] as const
const PAGE_TYPE_OPTIONS = [
  'handwerker',
  'handwerker_gewerk',
  'nachunternehmer',
  'nachunternehmer_gewerk',
  'leistung',
  'baukosten',
  'branchenbuch_gewerk',
  'branchenbuch_stadt',
  'branchenbuch_kombi',
] as const

export default function SeoFilters({
  initial,
}: {
  initial: { status?: string; pageType?: string; gewerkSlug?: string; citySlug?: string; minScore?: string }
}) {
  const router = useRouter()
  const [status, setStatus] = useState(initial.status || '')
  const [pageType, setPageType] = useState(initial.pageType || '')
  const [gewerkSlug, setGewerkSlug] = useState(initial.gewerkSlug || '')
  const [citySlug, setCitySlug] = useState(initial.citySlug || '')
  const [minScore, setMinScore] = useState(initial.minScore || '')

  function apply(e: React.FormEvent) {
    e.preventDefault()
    const params = new URLSearchParams()
    if (status) params.set('status', status)
    if (pageType) params.set('pageType', pageType)
    if (gewerkSlug) params.set('gewerkSlug', gewerkSlug)
    if (citySlug) params.set('citySlug', citySlug)
    if (minScore) params.set('minScore', minScore)
    router.push(`/dashboard/admin/seo${params.toString() ? `?${params.toString()}` : ''}`)
  }

  return (
    <form onSubmit={apply} className="flex flex-wrap gap-2 items-end mb-6">
      <div>
        <label className="block text-xs font-semibold text-slate-500 mb-1">Status</label>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white">
          <option value="">Alle</option>
          {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-xs font-semibold text-slate-500 mb-1">URL-Typ</label>
        <select value={pageType} onChange={(e) => setPageType(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white">
          <option value="">Alle</option>
          {PAGE_TYPE_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-xs font-semibold text-slate-500 mb-1">Gewerk-Slug</label>
        <input value={gewerkSlug} onChange={(e) => setGewerkSlug(e.target.value)} placeholder="z.B. trockenbau" className="border border-slate-300 rounded-lg px-3 py-2 text-sm w-36" />
      </div>
      <div>
        <label className="block text-xs font-semibold text-slate-500 mb-1">Stadt-Slug</label>
        <input value={citySlug} onChange={(e) => setCitySlug(e.target.value)} placeholder="z.B. berlin" className="border border-slate-300 rounded-lg px-3 py-2 text-sm w-32" />
      </div>
      <div>
        <label className="block text-xs font-semibold text-slate-500 mb-1">Score ≥</label>
        <input
          type="number"
          min={0}
          max={100}
          value={minScore}
          onChange={(e) => setMinScore(e.target.value)}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm w-20"
        />
      </div>
      <button type="submit" className="bg-[#17202a] hover:bg-slate-800 text-white text-sm font-bold px-4 py-2 rounded-lg">
        Filtern
      </button>
      {(status || pageType || gewerkSlug || citySlug || minScore) && (
        <button
          type="button"
          onClick={() => router.push('/dashboard/admin/seo')}
          className="text-sm font-semibold text-slate-500 hover:text-slate-700 px-2"
        >
          Zurücksetzen
        </button>
      )}
    </form>
  )
}

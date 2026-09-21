'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Status = 'DRAFT' | 'REVIEW' | 'INDEXABLE' | 'NOINDEX'

export default function SeoStatusActions({
  id,
  currentStatus,
  statusSource,
  initialNote,
}: {
  id: string
  currentStatus: Status
  statusSource: 'AUTO' | 'ADMIN'
  initialNote: string
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [note, setNote] = useState(initialNote)
  const [error, setError] = useState('')

  async function patch(body: Record<string, unknown>) {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/admin/seo/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Aktion fehlgeschlagen.')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler')
    } finally {
      setLoading(false)
    }
  }

  function setStatus(status: Status) {
    if (status === 'INDEXABLE' && !confirm('Diese Seite wirklich für Suchmaschinen freigeben (INDEXABLE)?')) return
    patch({ status })
  }

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5">
      <div>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Status ändern (Admin-Freigabe)</p>
        <div className="flex flex-wrap gap-2">
          {(['DRAFT', 'REVIEW', 'INDEXABLE', 'NOINDEX'] as Status[]).map((s) => (
            <button
              key={s}
              disabled={loading || currentStatus === s}
              onClick={() => setStatus(s)}
              className={`text-sm font-bold px-4 py-2 rounded-lg border transition disabled:opacity-40 ${
                s === 'INDEXABLE'
                  ? 'bg-green-600 hover:bg-green-700 text-white border-green-600'
                  : s === 'NOINDEX'
                  ? 'bg-red-50 hover:bg-red-100 text-red-700 border-red-200'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <p className="text-xs text-slate-400 mt-2">
          Nur eine explizite Auswahl hier setzt „status_source = ADMIN“ und sperrt die Kombination gegen künftige
          automatische Neubewertung.
        </p>
      </div>

      {statusSource === 'ADMIN' && (
        <button
          disabled={loading}
          onClick={() => patch({ resetToAuto: true })}
          className="text-sm font-semibold text-brand hover:underline disabled:opacity-50"
        >
          Admin-Sperre aufheben (zurück auf automatische Bewertung)
        </button>
      )}

      <div>
        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Admin-Notiz</label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          placeholder="z.B. Anbieterlage am 21.09. manuell geprüft, Freigabe begründet…"
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
        />
        <button
          disabled={loading}
          onClick={() => patch({ adminNote: note })}
          className="mt-2 text-sm font-bold text-white bg-[#17202a] hover:bg-slate-800 disabled:opacity-50 px-4 py-2 rounded-lg"
        >
          Notiz speichern
        </button>
      </div>

      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    </div>
  )
}

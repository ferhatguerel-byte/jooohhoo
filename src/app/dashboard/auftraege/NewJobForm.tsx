'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { GEWERKE } from '@/lib/gewerke'

export default function NewJobForm({ disabled }: { disabled: boolean }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const form = new FormData(e.currentTarget)
    const budgetMin = form.get('budgetMin')
    const budgetMax = form.get('budgetMax')
    const body = {
      title: form.get('title'),
      gewerk: form.get('gewerk'),
      plz: form.get('plz'),
      ort: form.get('ort'),
      description: form.get('description'),
      deadline: form.get('deadline') || undefined,
      budgetMin: budgetMin ? Number(budgetMin) : undefined,
      budgetMax: budgetMax ? Number(budgetMax) : undefined,
    }

    try {
      const res = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Auftrag konnte nicht erstellt werden.')
      setOpen(false)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler')
    } finally {
      setLoading(false)
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        disabled={disabled}
        className="bg-blue-900 hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-lg transition"
      >
        + Neuen Auftrag einstellen
      </button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4 mb-8">
      <h3 className="font-bold text-lg text-slate-900">Neuer Auftrag</h3>

      <div>
        <label htmlFor="title" className="block text-sm font-semibold text-slate-700 mb-1">Titel *</label>
        <input id="title" name="title" required minLength={5} className="w-full border border-slate-300 rounded-lg px-4 py-2.5" />
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        <div>
          <label htmlFor="gewerk" className="block text-sm font-semibold text-slate-700 mb-1">Gewerk *</label>
          <select id="gewerk" name="gewerk" required defaultValue="" className="w-full border border-slate-300 rounded-lg px-4 py-2.5 bg-white">
            <option value="" disabled>Bitte wählen</option>
            {GEWERKE.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="plz" className="block text-sm font-semibold text-slate-700 mb-1">PLZ *</label>
          <input id="plz" name="plz" required className="w-full border border-slate-300 rounded-lg px-4 py-2.5" />
        </div>
        <div>
          <label htmlFor="ort" className="block text-sm font-semibold text-slate-700 mb-1">Ort *</label>
          <input id="ort" name="ort" required className="w-full border border-slate-300 rounded-lg px-4 py-2.5" />
        </div>
      </div>

      <div>
        <label htmlFor="description" className="block text-sm font-semibold text-slate-700 mb-1">Beschreibung *</label>
        <textarea id="description" name="description" required minLength={20} rows={4} className="w-full border border-slate-300 rounded-lg px-4 py-2.5" />
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        <div>
          <label htmlFor="budgetMin" className="block text-sm font-semibold text-slate-700 mb-1">Budget von (€)</label>
          <input id="budgetMin" name="budgetMin" type="number" min={0} className="w-full border border-slate-300 rounded-lg px-4 py-2.5" />
        </div>
        <div>
          <label htmlFor="budgetMax" className="block text-sm font-semibold text-slate-700 mb-1">Budget bis (€)</label>
          <input id="budgetMax" name="budgetMax" type="number" min={0} className="w-full border border-slate-300 rounded-lg px-4 py-2.5" />
        </div>
        <div>
          <label htmlFor="deadline" className="block text-sm font-semibold text-slate-700 mb-1">Frist</label>
          <input id="deadline" name="deadline" type="date" min={new Date().toISOString().split('T')[0]} className="w-full border border-slate-300 rounded-lg px-4 py-2.5" />
        </div>
      </div>

      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-3">
        <button type="submit" disabled={loading} className="bg-blue-900 hover:bg-blue-800 disabled:opacity-50 text-white font-bold py-2.5 px-6 rounded-lg">
          {loading ? 'Wird erstellt…' : 'Auftrag veröffentlichen'}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-slate-500 font-medium px-4">
          Abbrechen
        </button>
      </div>
    </form>
  )
}

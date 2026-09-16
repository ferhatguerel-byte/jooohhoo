'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const CATEGORIES = ['Allgemein', 'Zahlung & Abo', 'Technisches Problem', 'Verifizierung', 'Auftrag/Angebot', 'Sonstiges']

export default function NewTicketForm() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const form = new FormData(e.currentTarget)

    try {
      const res = await fetch('/api/support/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: form.get('category'),
          subject: form.get('subject'),
          message: form.get('message'),
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Anfrage konnte nicht gesendet werden.')
      router.push(`/dashboard/support/${json.ticketId}`)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler')
      setLoading(false)
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="bg-brand hover:bg-brand-hover text-white text-sm font-bold px-5 py-2.5 rounded-lg"
      >
        + Neue Anfrage stellen
      </button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4 mb-6">
      <h2 className="font-bold text-slate-900">Neue Anfrage</h2>
      <label className="block">
        <span className="block text-sm font-semibold text-slate-700 mb-1">Kategorie</span>
        <select name="category" required className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="block text-sm font-semibold text-slate-700 mb-1">Betreff</span>
        <input name="subject" required maxLength={200} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
      </label>
      <label className="block">
        <span className="block text-sm font-semibold text-slate-700 mb-1">Nachricht</span>
        <textarea name="message" required rows={5} maxLength={4000} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
      </label>
      <div className="flex items-center gap-3">
        <button type="submit" disabled={loading} className="bg-brand hover:bg-brand-hover disabled:opacity-50 text-white text-sm font-bold px-5 py-2.5 rounded-lg">
          {loading ? 'Senden…' : 'Senden'}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-sm font-semibold text-slate-500">
          Abbrechen
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  )
}

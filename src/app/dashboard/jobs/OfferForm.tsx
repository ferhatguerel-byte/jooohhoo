'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function OfferForm({ jobId, existingOffer }: { jobId: string; existingOffer?: { price: number; message: string | null } }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const form = new FormData(e.currentTarget)
    const body = {
      price: Number(form.get('price')),
      message: form.get('message') || undefined,
    }

    try {
      const res = await fetch(`/api/jobs/${jobId}/offers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Angebot konnte nicht übermittelt werden.')
      setSuccess(true)
      setOpen(false)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler')
    } finally {
      setLoading(false)
    }
  }

  if (success || existingOffer) {
    return (
      <p className="text-sm font-semibold text-green-700">
        ✓ Angebot abgegeben{existingOffer ? `: €${existingOffer.price}` : ''}
      </p>
    )
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="bg-orange-500 hover:bg-orange-400 text-white font-bold text-sm py-2 px-4 rounded-lg">
        Angebot abgeben
      </button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 mt-2">
      <div className="flex gap-3">
        <input
          name="price"
          type="number"
          min={1}
          required
          placeholder="Preis in €"
          className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm"
        />
      </div>
      <textarea
        name="message"
        rows={2}
        placeholder="Kurze Nachricht an den Auftraggeber (optional)"
        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
      />
      {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={loading} className="bg-orange-500 hover:bg-orange-400 disabled:opacity-50 text-white font-bold text-sm py-2 px-4 rounded-lg">
          {loading ? 'Wird gesendet…' : 'Angebot senden'}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-slate-500 text-sm px-2">Abbrechen</button>
      </div>
    </form>
  )
}

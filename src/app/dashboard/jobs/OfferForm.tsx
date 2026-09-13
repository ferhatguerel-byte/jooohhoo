'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil } from 'lucide-react'

interface LineItem {
  id: string
  title: string
  gewerk: string
}

interface ExistingOffer {
  price: number
  message: string | null
  pricingType: 'fixed' | 'estimate'
  viewedByAuftraggeber: boolean
  lineItemPrices: Record<string, number>
}

export default function OfferForm({
  jobId,
  lineItems,
  existingOffer,
}: {
  jobId: string
  lineItems: LineItem[]
  existingOffer?: ExistingOffer
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [pricingType, setPricingType] = useState<'fixed' | 'estimate'>(existingOffer?.pricingType || 'fixed')
  const [itemPrices, setItemPrices] = useState<Record<string, string>>(() =>
    Object.fromEntries(Object.entries(existingOffer?.lineItemPrices || {}).map(([k, v]) => [k, String(v)]))
  )
  const [price, setPrice] = useState(existingOffer && lineItems.length === 0 ? String(existingOffer.price) : '')
  const [message, setMessage] = useState(existingOffer?.message || '')

  const total = useMemo(
    () => Object.values(itemPrices).reduce((sum, v) => sum + (Number(v) || 0), 0),
    [itemPrices]
  )

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const hasLineItems = lineItems.length > 0

    const body = hasLineItems
      ? {
          pricingType,
          message: message || undefined,
          lineItemPrices: lineItems
            .map((li) => ({ lineItemId: li.id, price: Number(itemPrices[li.id]) }))
            .filter((li) => li.price > 0),
        }
      : {
          pricingType,
          price: Number(price),
          message: message || undefined,
        }

    try {
      const res = await fetch(`/api/jobs/${jobId}/offers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Angebot konnte nicht übermittelt werden.')
      setOpen(false)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler')
    } finally {
      setLoading(false)
    }
  }

  if (existingOffer && !open) {
    return (
      <div className="flex items-center gap-3">
        <p className="text-sm font-semibold text-green-700">✓ Angebot abgegeben: €{existingOffer.price}</p>
        {existingOffer.viewedByAuftraggeber ? (
          <span className="text-xs text-slate-400">Vom Auftraggeber bereits angesehen – keine Korrektur mehr möglich</span>
        ) : (
          <button
            onClick={() => setOpen(true)}
            className="text-xs font-semibold text-brand hover:underline flex items-center gap-1"
          >
            <Pencil size={12} /> Korrigieren
          </button>
        )}
      </div>
    )
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="bg-[#f47b20] hover:bg-[#e06c14] text-white font-bold text-sm py-2 px-4 rounded-lg">
        Angebot abgeben
      </button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 mt-2 border-t border-slate-100 pt-4">
      {lineItems.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Preis je Position</p>
          {lineItems.map((li) => (
            <div key={li.id} className="flex items-center justify-between gap-3">
              <label htmlFor={`price-${li.id}`} className="text-sm text-slate-700 flex-1">{li.title}</label>
              <input
                id={`price-${li.id}`}
                type="number"
                min={1}
                required
                placeholder="€"
                value={itemPrices[li.id] || ''}
                onChange={(e) => setItemPrices((prev) => ({ ...prev, [li.id]: e.target.value }))}
                className="w-28 border border-slate-300 rounded-lg px-3 py-1.5 text-sm"
              />
            </div>
          ))}
          <div className="flex items-center justify-between pt-2 border-t border-slate-100 font-bold text-sm text-[#17202a]">
            <span>Gesamt</span>
            <span>€{total}</span>
          </div>
        </div>
      ) : (
        <input
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          type="number"
          min={1}
          required
          placeholder="Preis in €"
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
        />
      )}

      <div className="flex gap-4 text-sm">
        <label className="flex items-center gap-1.5">
          <input type="radio" name="pt" checked={pricingType === 'fixed'} onChange={() => setPricingType('fixed')} />
          Festpreis garantiert
        </label>
        <label className="flex items-center gap-1.5">
          <input type="radio" name="pt" checked={pricingType === 'estimate'} onChange={() => setPricingType('estimate')} />
          Preis nach Aufmaß
        </label>
      </div>

      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={2}
        placeholder="Kurze Nachricht an den Auftraggeber (optional)"
        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
      />

      {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={loading} className="bg-[#f47b20] hover:bg-[#e06c14] disabled:opacity-50 text-white font-bold text-sm py-2 px-4 rounded-lg">
          {loading ? 'Wird gesendet…' : existingOffer ? 'Angebot aktualisieren' : 'Angebot senden'}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-slate-500 text-sm px-2">Abbrechen</button>
      </div>
    </form>
  )
}

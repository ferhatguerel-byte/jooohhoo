'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { TierId } from '@/lib/tiers'

interface PreviewData {
  id: string
  targetTier: TierId
  amountDueCents: number
  currency: string
  periodEnd: string
  expiresAt: string
}

function formatAmount(cents: number, currency: string): string {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: currency.toUpperCase() }).format(cents / 100)
}

/**
 * Phase 2B (Aufgabe 3) – ersetzt den bisherigen Sofort-Wechsel-Button. Ablauf jetzt zweistufig:
 * 1. Vorschau anfordern (POST /api/billing/tier-change-preview) – zeigt den tatsächlich von
 *    Stripe berechneten Betrag, bevor irgendetwas ausgeführt wird.
 * 2. Erst nach ausdrücklicher Bestätigung wird gewechselt (POST /api/billing/checkout mit der
 *    erhaltenen previewId) – der angezeigte Betrag kommt direkt aus der Server-Antwort, nie aus
 *    einer client-seitigen Berechnung.
 * Eine abgelaufene/ungültige Vorschau (409 von der Confirm-Route) führt zurück in den
 * Vorschau-Zustand mit einer Fehlermeldung, nicht zu einem stillen Fehlschlag.
 *
 * Die konkrete Button-Beschriftung für den Bestätigungsschritt ("Jetzt für X wechseln –
 * zahlungspflichtig") ist eine technische Formulierung, die den tatsächlich fälligen Betrag
 * eindeutig ausdrückt. Ob diese Formulierung für den Fall eines Verbraucher-Abschlusses exakt
 * § 312j BGB entspricht, ist NICHT Teil dieser technischen Phase und bedarf einer gesonderten
 * rechtlichen Prüfung (siehe Abschlussbericht Phase 2B).
 */
export default function TierChangeButton({ tier }: { tier: TierId }) {
  const router = useRouter()
  const [preview, setPreview] = useState<PreviewData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  // React-Reinheitsregel: Date.now() darf nicht direkt während des Renderns aufgerufen werden
  // (impure). Der Ablaufstatus wird stattdessen außerhalb des Renderns in einem Effekt ermittelt
  // und als State gehalten; die letztliche, verbindliche Prüfung bleibt ohnehin serverseitig
  // (claimTierChangePreview prüft `expires_at > now()` atomar in der DB).
  const [expired, setExpired] = useState(false)

  useEffect(() => {
    if (!preview) return
    const expiresAtMs = new Date(preview.expiresAt).getTime()
    const interval = setInterval(() => setExpired(Date.now() >= expiresAtMs), 1000)
    return () => clearInterval(interval)
  }, [preview])

  async function requestPreview() {
    setLoading(true)
    setError('')
    setPreview(null)
    try {
      const res = await fetch('/api/billing/tier-change-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Preisvorschau fehlgeschlagen.')
      setPreview(json)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler')
    } finally {
      setLoading(false)
    }
  }

  async function confirmChange() {
    if (!preview) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier, previewId: preview.id }),
      })
      const json = await res.json()
      if (!res.ok) {
        // Veraltete/bereits verwendete Vorschau (409) -> zurück in den Ausgangszustand, damit der
        // Nutzer gezielt eine neue Vorschau anfordern kann, statt in einer Fehlermeldung hängen
        // zu bleiben (Aufgabe 3.4: sicherer Abbruch bei veralteter Vorschau).
        setPreview(null)
        throw new Error(json.error || 'Wechsel fehlgeschlagen.')
      }
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler')
    } finally {
      setLoading(false)
    }
  }

  if (preview) {
    return (
      <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
        {expired ? (
          <p className="text-sm text-slate-700 mb-3">Diese Vorschau ist abgelaufen.</p>
        ) : (
          <>
            <p className="text-sm text-slate-700 mb-1">
              Fällig bei Wechsel: <strong>{formatAmount(preview.amountDueCents, preview.currency)}</strong>
            </p>
            <p className="text-xs text-slate-500 mb-3">
              Nächste reguläre Abrechnung: {new Date(preview.periodEnd).toLocaleDateString('de-DE')}
            </p>
          </>
        )}
        <div className="flex items-center gap-3">
          {!expired && (
            <button
              onClick={confirmChange}
              disabled={loading}
              className="bg-[#17202a] hover:bg-slate-800 disabled:opacity-50 text-white text-sm font-bold px-4 py-2 rounded-lg"
            >
              {loading ? 'Wird gewechselt…' : `Jetzt für ${formatAmount(preview.amountDueCents, preview.currency)} wechseln (zahlungspflichtig)`}
            </button>
          )}
          <button onClick={expired ? requestPreview : () => setPreview(null)} disabled={loading} className="text-sm font-semibold text-slate-500">
            {expired ? 'Neue Vorschau anfordern' : 'Abbrechen'}
          </button>
        </div>
        {error && <p role="alert" className="text-xs text-red-600 mt-2">{error}</p>}
      </div>
    )
  }

  return (
    <div>
      <button
        onClick={requestPreview}
        disabled={loading}
        className="w-full bg-brand hover:bg-brand-hover disabled:opacity-50 text-white font-bold py-3 rounded-lg"
      >
        {loading ? 'Preisvorschau wird berechnet…' : 'Wechseln'}
      </button>
      {error && <p role="alert" className="text-xs text-red-600 mt-2">{error}</p>}
    </div>
  )
}

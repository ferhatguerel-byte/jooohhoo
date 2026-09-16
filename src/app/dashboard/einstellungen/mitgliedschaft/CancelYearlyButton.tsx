'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function CancelYearlyButton({ cancelAt }: { cancelAt: string | null }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [confirming, setConfirming] = useState(false)

  async function handleCancel() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/billing/cancel-yearly', { method: 'POST' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Fehler.')
      setConfirming(false)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler')
    } finally {
      setLoading(false)
    }
  }

  async function handleRevoke() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/billing/cancel-yearly', { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Fehler.')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler')
    } finally {
      setLoading(false)
    }
  }

  if (cancelAt) {
    return (
      <div>
        <p className="text-sm text-slate-700">
          Kündigung eingegangen — Ihr Vertrag endet zum{' '}
          <strong>{new Date(cancelAt).toLocaleDateString('de-DE')}</strong>.
        </p>
        <button onClick={handleRevoke} disabled={loading} className="text-sm font-semibold text-brand hover:underline mt-2 disabled:opacity-50">
          {loading ? 'Wird zurückgezogen…' : 'Kündigung zurückziehen'}
        </button>
        {error && <p role="alert" className="text-xs text-red-600 mt-2">{error}</p>}
      </div>
    )
  }

  if (confirming) {
    return (
      <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
        <p className="text-sm text-slate-700 mb-3">
          Ihre Kündigung wird zum Ende der aktuellen Vertragslaufzeit wirksam (unter Einhaltung der 3-monatigen
          Kündigungsfrist). Sie behalten den vollen Zugriff bis dahin.
        </p>
        <div className="flex items-center gap-3">
          <button onClick={handleCancel} disabled={loading} className="bg-[#17202a] hover:bg-slate-800 disabled:opacity-50 text-white text-sm font-bold px-4 py-2 rounded-lg">
            {loading ? 'Wird gesendet…' : 'Kündigung bestätigen'}
          </button>
          <button onClick={() => setConfirming(false)} className="text-sm font-semibold text-slate-500">
            Abbrechen
          </button>
        </div>
        {error && <p role="alert" className="text-xs text-red-600 mt-2">{error}</p>}
      </div>
    )
  }

  return (
    <button onClick={() => setConfirming(true)} className="text-sm font-semibold text-slate-500 hover:text-red-600">
      Vertrag kündigen
    </button>
  )
}

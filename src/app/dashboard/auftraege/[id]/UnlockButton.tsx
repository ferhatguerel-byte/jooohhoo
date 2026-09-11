'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function UnlockButton({ offerId }: { offerId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleUnlock() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/offers/${offerId}/unlock`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Freischalten fehlgeschlagen.')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler')
      setLoading(false)
    }
  }

  return (
    <div>
      <button
        onClick={handleUnlock}
        disabled={loading}
        className="bg-orange-500 hover:bg-orange-400 disabled:opacity-50 text-white font-bold text-sm py-2 px-4 rounded-lg"
      >
        {loading ? 'Wird freigeschaltet…' : 'Kontakt freischalten'}
      </button>
      {error && <p role="alert" className="text-xs text-red-600 mt-2">{error}</p>}
    </div>
  )
}

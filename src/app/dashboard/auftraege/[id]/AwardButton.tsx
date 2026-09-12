'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function AwardButton({ jobId, offerId }: { jobId: string; offerId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleAward() {
    if (!confirm('Diesen Subunternehmer beauftragen? Alle anderen Angebote werden automatisch abgelehnt.')) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/jobs/${jobId}/award`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ offerId }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Fehler.')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler')
      setLoading(false)
    }
  }

  return (
    <div>
      <button
        onClick={handleAward}
        disabled={loading}
        className="bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-bold text-sm py-2 px-4 rounded-lg"
      >
        {loading ? 'Wird vergeben…' : '✓ Auftrag vergeben'}
      </button>
      {error && <p role="alert" className="text-xs text-red-600 mt-2">{error}</p>}
    </div>
  )
}

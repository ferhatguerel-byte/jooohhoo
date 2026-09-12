'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Star } from 'lucide-react'

export default function ReviewForm({
  jobId,
  existingReview,
}: {
  jobId: string
  existingReview?: { rating: number; comment: string | null }
}) {
  const router = useRouter()
  const [rating, setRating] = useState(existingReview?.rating || 0)
  const [hoverRating, setHoverRating] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(!!existingReview)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (rating === 0) {
      setError('Bitte wählen Sie eine Sternebewertung.')
      return
    }
    setLoading(true)
    setError('')

    const form = new FormData(e.currentTarget)
    try {
      const res = await fetch(`/api/jobs/${jobId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating, comment: form.get('comment') || undefined }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Bewertung fehlgeschlagen.')
      setSaved(true)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler')
    } finally {
      setLoading(false)
    }
  }

  if (saved && !loading) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-xl p-5">
        <p className="text-sm font-semibold text-green-800 mb-1">✓ Bewertung gespeichert</p>
        <div className="flex gap-0.5 mb-1">
          {[1, 2, 3, 4, 5].map((i) => (
            <Star key={i} size={16} className={i <= rating ? 'fill-accent text-accent' : 'text-slate-300'} />
          ))}
        </div>
        <button onClick={() => setSaved(false)} className="text-xs text-brand hover:underline">Bearbeiten</button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-xl p-5">
      <h3 className="font-bold text-slate-900 mb-3">Subunternehmer bewerten</h3>
      <div className="flex gap-1 mb-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <button
            key={i}
            type="button"
            onClick={() => setRating(i)}
            onMouseEnter={() => setHoverRating(i)}
            onMouseLeave={() => setHoverRating(0)}
            aria-label={`${i} Sterne`}
          >
            <Star
              size={28}
              className={i <= (hoverRating || rating) ? 'fill-accent text-accent' : 'text-slate-300'}
            />
          </button>
        ))}
      </div>
      <textarea
        name="comment"
        rows={2}
        defaultValue={existingReview?.comment || ''}
        placeholder="Kurzer Kommentar zur Zusammenarbeit (optional)"
        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mb-3"
      />
      {error && <p role="alert" className="text-xs text-red-600 mb-2">{error}</p>}
      <button type="submit" disabled={loading} className="bg-brand hover:bg-brand-hover disabled:opacity-50 text-white font-bold text-sm py-2 px-4 rounded-lg">
        {loading ? 'Wird gespeichert…' : 'Bewertung speichern'}
      </button>
    </form>
  )
}

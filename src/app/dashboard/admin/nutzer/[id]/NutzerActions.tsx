'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { GEWERKE } from '@/lib/gewerke'

export function GewerkeBlockList({ userId, gewerke, blockedGewerke }: { userId: string; gewerke: string[]; blockedGewerke: string[] }) {
  const router = useRouter()
  const [loadingGewerk, setLoadingGewerk] = useState<string | null>(null)

  async function toggle(gewerk: string, currentlyBlocked: boolean) {
    setLoadingGewerk(gewerk)
    try {
      await fetch(`/api/admin/users/${userId}/gewerke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gewerk, blocked: !currentlyBlocked }),
      })
      router.refresh()
    } finally {
      setLoadingGewerk(null)
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      {GEWERKE.map((g) => {
        const active = gewerke.includes(g)
        const blocked = blockedGewerke.includes(g)
        return (
          <button
            key={g}
            type="button"
            disabled={loadingGewerk === g}
            onClick={() => toggle(g, blocked)}
            title={blocked ? 'Klicken zum Entsperren' : 'Klicken zum Sperren'}
            className={`px-3 py-1.5 rounded-full text-sm border transition disabled:opacity-50 ${
              blocked
                ? 'bg-red-50 border-red-300 text-red-700'
                : active
                ? 'bg-accent border-accent text-white'
                : 'border-slate-300 text-slate-500'
            }`}
          >
            {blocked ? `🚫 ${g}` : g}
          </button>
        )
      })}
    </div>
  )
}

export function AccountStatusToggle({ userId, status }: { userId: string; status: 'active' | 'suspended' }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function setStatus(next: 'active' | 'suspended') {
    setLoading(true)
    try {
      await fetch(`/api/admin/users/${userId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      })
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  if (status === 'suspended') {
    return (
      <button onClick={() => setStatus('active')} disabled={loading} className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-bold px-4 py-2 rounded-lg">
        {loading ? 'Wird entsperrt…' : 'Konto entsperren'}
      </button>
    )
  }

  return (
    <button onClick={() => setStatus('suspended')} disabled={loading} className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-bold px-4 py-2 rounded-lg">
      {loading ? 'Wird gesperrt…' : 'Konto sperren'}
    </button>
  )
}

export function CancelSubscriptionButton({ userId, hasSubscription }: { userId: string; hasSubscription: boolean }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState('')

  async function handleCancel() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/admin/users/${userId}/cancel-subscription`, { method: 'POST' })
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

  if (!hasSubscription) return <p className="text-sm text-slate-400">Kein aktives Abo vorhanden.</p>

  if (confirming) {
    return (
      <div>
        <p className="text-sm text-red-700 mb-2">
          Das Abo wird sofort in Stripe beendet, unabhängig von Mindestlaufzeit oder Kündigungsfrist. Sicher?
        </p>
        <div className="flex items-center gap-3">
          <button onClick={handleCancel} disabled={loading} className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-bold px-4 py-2 rounded-lg">
            {loading ? 'Wird beendet…' : 'Ja, sofort beenden'}
          </button>
          <button onClick={() => setConfirming(false)} className="text-sm font-semibold text-slate-500">Abbrechen</button>
        </div>
        {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
      </div>
    )
  }

  return (
    <button onClick={() => setConfirming(true)} className="text-sm font-semibold text-red-600 hover:underline">
      Abo sofort kündigen (Admin)
    </button>
  )
}

export function WarningForm({ userId }: { userId: string }) {
  const router = useRouter()
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!message.trim()) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/admin/users/${userId}/warning`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Fehler.')
      setMessage('')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Text der Mahnung/des Hinweises, wird per E-Mail an den Nutzer gesendet…"
        rows={3}
        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
      />
      <button type="submit" disabled={loading} className="bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white text-sm font-bold px-4 py-2 rounded-lg">
        {loading ? 'Wird gesendet…' : 'Mahnung senden'}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </form>
  )
}

export function NotesForm({ userId, initialNotes }: { userId: string; initialNotes: string }) {
  const [notes, setNotes] = useState(initialNotes)
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)

  async function handleSave() {
    setLoading(true)
    setSaved(false)
    try {
      await fetch(`/api/admin/users/${userId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes }),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-2">
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Interne Notizen, nur für Admins sichtbar…"
        rows={4}
        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
      />
      <button onClick={handleSave} disabled={loading} className="bg-[#17202a] hover:bg-slate-800 disabled:opacity-50 text-white text-sm font-bold px-4 py-2 rounded-lg">
        {loading ? 'Speichern…' : 'Notizen speichern'}
      </button>
      {saved && <span className="text-xs text-green-700 ml-2">Gespeichert.</span>}
    </div>
  )
}

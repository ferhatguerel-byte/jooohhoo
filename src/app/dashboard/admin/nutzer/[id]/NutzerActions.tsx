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

export function AccountStatusToggle({ userId, status }: { userId: string; status: 'active' | 'suspended' | 'deleted' }) {
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

  // Ein gelöschtes Konto ist endgültig – Sperren/Entsperren ergibt hier keinen Sinn mehr
  // (siehe DeleteProviderForm weiter unten für den Löschbereich dieser Seite).
  if (status === 'deleted') {
    return <p className="text-sm text-slate-400">Dieses Unternehmen wurde gelöscht.</p>
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

/**
 * "Unternehmen löschen" – die destruktivste Admin-Aktion, daher die strengste Bestätigung im
 * gesamten Admin-Bereich. Es existiert im Codebase noch keine echte Modal-/Dialog-Komponente
 * (keine role="dialog"-Stelle, kein Overlay) – stattdessen folgt diese Komponente demselben
 * bereits etablierten Muster wie CancelSubscriptionButton oben: eine inline aufklappende
 * Bestätigungsfläche statt eines browser-nativen confirm().
 *
 * Der "Endgültig löschen"-Button ist erst aktiv, wenn der eingegebene Text exakt dem aktuellen
 * Firmennamen entspricht UND kein aktives/überfälliges Abo mehr besteht – beides wird zusätzlich
 * serverseitig in der Route selbst geprüft (siehe api/admin/users/[id]/delete/route.ts), diese
 * Client-Prüfung ist reine UX, keine Sicherheitsgrenze.
 */
export function DeleteProviderForm({
  userId,
  companyName,
  subscriptionStatus,
}: {
  userId: string
  companyName: string
  subscriptionStatus: 'inactive' | 'active' | 'canceled' | 'past_due'
}) {
  const router = useRouter()
  const [expanded, setExpanded] = useState(false)
  const [confirmationName, setConfirmationName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const hasBlockingSubscription = subscriptionStatus === 'active' || subscriptionStatus === 'past_due'
  const nameMatches = confirmationName === companyName

  async function handleDelete() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/admin/users/${userId}/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmationName }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Löschung fehlgeschlagen.')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler')
    } finally {
      setLoading(false)
    }
  }

  if (!expanded) {
    return (
      <button onClick={() => setExpanded(true)} className="text-sm font-semibold text-red-600 hover:underline">
        Unternehmen löschen
      </button>
    )
  }

  return (
    <div className="border border-red-200 bg-red-50/50 rounded-xl p-4 space-y-3">
      <p className="text-sm font-bold text-red-700">Warnung: Diese Aktion kann nicht rückgängig gemacht werden.</p>
      <ul className="text-sm text-slate-600 list-disc list-inside space-y-0.5">
        <li>Das Unternehmen wird dauerhaft aus dem Branchenbuch entfernt.</li>
        <li>Persönliche Kontaktdaten (E-Mail, Telefon, Login) werden anonymisiert.</li>
        <li>Historische Aufträge, Angebote und Bewertungen bleiben für die jeweils andere Seite erhalten.</li>
      </ul>

      {hasBlockingSubscription ? (
        <p className="text-sm font-semibold text-orange-700 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2">
          Bitte zuerst das Abonnement kündigen (siehe „Abo sofort kündigen (Admin)&rdquo; oben).
        </p>
      ) : (
        <div>
          <label htmlFor={`confirm-delete-${userId}`} className="block text-sm text-slate-700 mb-1">
            Zur Bestätigung bitte den Firmennamen eingeben: <strong>{companyName}</strong>
          </label>
          <input
            id={`confirm-delete-${userId}`}
            type="text"
            value={confirmationName}
            onChange={(e) => setConfirmationName(e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
            autoComplete="off"
          />
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          onClick={handleDelete}
          disabled={loading || hasBlockingSubscription || !nameMatches}
          className="bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-bold px-4 py-2 rounded-lg"
        >
          {loading ? 'Wird gelöscht…' : 'Endgültig löschen'}
        </button>
        <button
          onClick={() => {
            setExpanded(false)
            setConfirmationName('')
            setError('')
          }}
          className="text-sm font-semibold text-slate-500"
        >
          Abbrechen
        </button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
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

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

function Field({ label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="block">
      <span className="block text-sm font-semibold text-slate-700 mb-1">{label}</span>
      <input
        {...props}
        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
      />
    </label>
  )
}

export function EmailForm({ currentEmail }: { currentEmail: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSaved(false)
    const form = new FormData(e.currentTarget)

    try {
      const res = await fetch('/api/account/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newEmail: form.get('newEmail'),
          currentPassword: form.get('currentPassword'),
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Fehler beim Speichern.')
      setSaved(true)
      ;(e.target as HTMLFormElement).reset()
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-slate-500">
        Aktuelle E-Mail: <span className="font-semibold text-slate-700">{currentEmail}</span>
      </p>
      <Field label="Neue E-Mail-Adresse" name="newEmail" type="email" required />
      <Field label="Aktuelles Passwort zur Bestätigung" name="currentPassword" type="password" required />
      <button
        type="submit"
        disabled={loading}
        className="bg-[#17202a] hover:bg-slate-800 disabled:opacity-50 text-white text-sm font-bold px-5 py-2.5 rounded-lg"
      >
        {loading ? 'Speichern…' : 'E-Mail-Adresse ändern'}
      </button>
      {saved && <p className="text-sm text-green-700">E-Mail-Adresse wurde geändert.</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  )
}

export function PasswordForm() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSaved(false)
    const form = new FormData(e.currentTarget)
    const newPassword = form.get('newPassword') as string
    const confirmPassword = form.get('confirmPassword') as string

    if (newPassword !== confirmPassword) {
      setError('Die neuen Passwörter stimmen nicht überein.')
      setLoading(false)
      return
    }

    try {
      const res = await fetch('/api/account/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: form.get('currentPassword'),
          newPassword,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Fehler beim Speichern.')
      setSaved(true)
      ;(e.target as HTMLFormElement).reset()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Field label="Aktuelles Passwort" name="currentPassword" type="password" required />
      <Field label="Neues Passwort" name="newPassword" type="password" minLength={8} required />
      <Field label="Neues Passwort bestätigen" name="confirmPassword" type="password" minLength={8} required />
      <button
        type="submit"
        disabled={loading}
        className="bg-[#17202a] hover:bg-slate-800 disabled:opacity-50 text-white text-sm font-bold px-5 py-2.5 rounded-lg"
      >
        {loading ? 'Speichern…' : 'Passwort ändern'}
      </button>
      {saved && <p className="text-sm text-green-700">Passwort wurde geändert.</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  )
}

function ToggleRow({
  checked,
  onToggle,
  disabled,
  label,
  description,
}: {
  checked: boolean
  onToggle: () => void
  disabled: boolean
  label: string
  description: string
}) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-slate-100 last:border-0">
      <div>
        <p className="text-sm font-semibold text-slate-800">{label}</p>
        <p className="text-xs text-slate-500">{description}</p>
      </div>
      <button
        type="button"
        disabled={disabled}
        onClick={onToggle}
        className={`relative w-11 h-6 rounded-full transition-colors ${checked ? 'bg-brand' : 'bg-slate-300'}`}
      >
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${checked ? 'translate-x-5' : ''}`} />
      </button>
    </div>
  )
}

export function NotificationsForm({
  initialEmailNotifications,
  initialNewsletterOptIn,
}: {
  initialEmailNotifications: boolean
  initialNewsletterOptIn: boolean
}) {
  const [emailNotifications, setEmailNotifications] = useState(initialEmailNotifications)
  const [newsletterOptIn, setNewsletterOptIn] = useState(initialNewsletterOptIn)
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)

  async function save(next: { emailNotifications: boolean; newsletterOptIn: boolean }) {
    setLoading(true)
    setSaved(false)
    try {
      await fetch('/api/account/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <ToggleRow
        checked={emailNotifications}
        disabled={loading}
        onToggle={() => {
          const value = !emailNotifications
          setEmailNotifications(value)
          save({ emailNotifications: value, newsletterOptIn })
        }}
        label="E-Mail-Benachrichtigungen"
        description="Neue Angebote, Nachrichten und Auftragsvergaben per E-Mail erhalten."
      />
      <ToggleRow
        checked={newsletterOptIn}
        disabled={loading}
        onToggle={() => {
          const value = !newsletterOptIn
          setNewsletterOptIn(value)
          save({ emailNotifications, newsletterOptIn: value })
        }}
        label="Newsletter"
        description="Gelegentliche Tipps und Neuigkeiten von BAUVERSUS."
      />
      {saved && <p className="text-xs text-green-700 mt-2">Gespeichert.</p>}
    </div>
  )
}

export function DirectoryListingForm({ initialListed }: { initialListed: boolean }) {
  const [listed, setListed] = useState(initialListed)
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)

  async function toggle() {
    const value = !listed
    setListed(value)
    setLoading(true)
    setSaved(false)
    try {
      await fetch('/api/account/directory-listing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listed: value }),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <ToggleRow
        checked={listed}
        disabled={loading}
        onToggle={toggle}
        label="Im Branchenbuch anzeigen"
        description="Ihr Firmenprofil ist öffentlich über Google auffindbar – gut für Ihre eigene Sichtbarkeit."
      />
      {saved && <p className="text-xs text-green-700 mt-2">Gespeichert.</p>}
    </div>
  )
}

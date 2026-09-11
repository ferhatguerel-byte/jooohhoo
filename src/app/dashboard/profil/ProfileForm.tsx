'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { GEWERKE } from '@/lib/gewerke'

interface Props {
  role: 'auftraggeber' | 'subunternehmer'
  companyName: string
  phone: string | null
  plz: string
  ort: string
  gewerke: string[]
}

export default function ProfileForm({ role, companyName, phone, plz, ort, gewerke: initialGewerke }: Props) {
  const router = useRouter()
  const [gewerke, setGewerke] = useState<string[]>(initialGewerke)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  function toggleGewerk(g: string) {
    setGewerke((prev) => (prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]))
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSaved(false)

    const form = new FormData(e.currentTarget)
    const body = {
      companyName: form.get('companyName'),
      phone: form.get('phone'),
      plz: form.get('plz'),
      ort: form.get('ort'),
      gewerke: role === 'subunternehmer' ? gewerke : undefined,
    }

    try {
      const res = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Speichern fehlgeschlagen.')
      setSaved(true)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="companyName" className="block text-sm font-semibold text-slate-700 mb-1">Firmenname</label>
        <input id="companyName" name="companyName" defaultValue={companyName} required className="w-full border border-slate-300 rounded-lg px-4 py-2.5" />
      </div>
      <div className="grid sm:grid-cols-3 gap-4">
        <div>
          <label htmlFor="phone" className="block text-sm font-semibold text-slate-700 mb-1">Telefon</label>
          <input id="phone" name="phone" defaultValue={phone || ''} className="w-full border border-slate-300 rounded-lg px-4 py-2.5" />
        </div>
        <div>
          <label htmlFor="plz" className="block text-sm font-semibold text-slate-700 mb-1">PLZ</label>
          <input id="plz" name="plz" defaultValue={plz} required className="w-full border border-slate-300 rounded-lg px-4 py-2.5" />
        </div>
        <div>
          <label htmlFor="ort" className="block text-sm font-semibold text-slate-700 mb-1">Ort</label>
          <input id="ort" name="ort" defaultValue={ort} required className="w-full border border-slate-300 rounded-lg px-4 py-2.5" />
        </div>
      </div>

      {role === 'subunternehmer' && (
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">Gewerke</label>
          <div className="flex flex-wrap gap-2">
            {GEWERKE.map((g) => (
              <button
                type="button"
                key={g}
                onClick={() => toggleGewerk(g)}
                className={`px-3 py-1.5 rounded-full text-sm border transition ${
                  gewerke.includes(g) ? 'bg-accent border-accent text-white' : 'border-slate-300 text-slate-600'
                }`}
              >
                {g}
              </button>
            ))}
          </div>
        </div>
      )}

      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      {saved && <p className="text-sm text-green-700">✓ Gespeichert</p>}

      <button type="submit" disabled={loading} className="bg-brand hover:bg-brand-hover disabled:opacity-50 text-white font-bold py-2.5 px-6 rounded-lg">
        {loading ? 'Wird gespeichert…' : 'Speichern'}
      </button>
    </form>
  )
}

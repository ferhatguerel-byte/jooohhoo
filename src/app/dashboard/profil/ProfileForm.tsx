'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { GEWERKE } from '@/lib/gewerke'
import FileUploader, { UploadedFile } from '@/components/FileUploader'

interface QualificationFile extends UploadedFile {
  label: string
}

interface Props {
  role: 'auftraggeber' | 'subunternehmer'
  companyName: string
  phone: string | null
  plz: string
  ort: string
  gewerke: string[]
  verificationStatus?: 'unverified' | 'pending' | 'verified' | 'rejected'
  qualificationFiles?: QualificationFile[]
}

const VERIFICATION_LABELS: Record<string, { text: string; className: string }> = {
  unverified: { text: 'Nicht verifiziert', className: 'bg-slate-100 text-slate-500' },
  pending: { text: 'Prüfung läuft', className: 'bg-orange-100 text-orange-700' },
  verified: { text: 'Verifiziert ✓', className: 'bg-blue-100 text-blue-700' },
  rejected: { text: 'Nachweise abgelehnt – bitte erneut hochladen', className: 'bg-red-100 text-red-700' },
}

export default function ProfileForm({
  role,
  companyName,
  phone,
  plz,
  ort,
  gewerke: initialGewerke,
  verificationStatus = 'unverified',
  qualificationFiles: initialQualificationFiles = [],
}: Props) {
  const router = useRouter()
  const [gewerke, setGewerke] = useState<string[]>(initialGewerke)
  const [qualificationFiles, setQualificationFiles] = useState<QualificationFile[]>(initialQualificationFiles)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  function setFilesForLabel(label: string, files: UploadedFile[]) {
    setQualificationFiles((prev) => [
      ...prev.filter((f) => f.label !== label),
      ...files.map((f) => ({ ...f, label })),
    ])
  }

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
      qualificationFiles: role === 'subunternehmer' ? qualificationFiles : undefined,
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
        <label htmlFor="companyName" className="block text-sm font-semibold text-slate-700 mb-1">
          {role === 'auftraggeber' ? 'Name / Firmenname' : 'Firmenname'}
        </label>
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

      {role === 'subunternehmer' && (
        <div className="border-t border-slate-200 pt-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900">Verifizierung</h3>
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${VERIFICATION_LABELS[verificationStatus].className}`}>
              {VERIFICATION_LABELS[verificationStatus].text}
            </span>
          </div>
          <p className="text-sm text-slate-500">
            Laden Sie Nachweise hoch (Gewerbeanmeldung, Meisterbrief/Qualifikationsnachweis, Haftpflichtversicherung).
            Wir prüfen diese manuell; erst danach erhalten Sie das Verifiziert-Abzeichen, das Kunden bei Ihren Angeboten sehen.
          </p>
          <FileUploader
            label="Gewerbeanmeldung"
            accept=".pdf,image/*"
            multiple={false}
            files={qualificationFiles.filter((f) => f.label === 'Gewerbeanmeldung')}
            onChange={(files) => setFilesForLabel('Gewerbeanmeldung', files)}
          />
          <FileUploader
            label="Meisterbrief / Qualifikationsnachweis"
            accept=".pdf,image/*"
            multiple={false}
            files={qualificationFiles.filter((f) => f.label === 'Meisterbrief / Qualifikationsnachweis')}
            onChange={(files) => setFilesForLabel('Meisterbrief / Qualifikationsnachweis', files)}
          />
          <FileUploader
            label="Haftpflichtversicherung"
            accept=".pdf,image/*"
            multiple={false}
            files={qualificationFiles.filter((f) => f.label === 'Haftpflichtversicherung')}
            onChange={(files) => setFilesForLabel('Haftpflichtversicherung', files)}
          />
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

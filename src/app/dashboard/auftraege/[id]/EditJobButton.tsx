'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil } from 'lucide-react'

export default function EditJobButton({
  jobId,
  initialTitle,
  initialDescription,
  initialDeadline,
}: {
  jobId: string
  initialTitle: string
  initialDescription: string
  initialDeadline: string | null
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState(initialTitle)
  const [description, setDescription] = useState(initialDescription)
  const [deadline, setDeadline] = useState(initialDeadline ? initialDeadline.slice(0, 10) : '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSave() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/jobs/${jobId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description, deadline: deadline || undefined }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Speichern fehlgeschlagen.')
      setOpen(false)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler')
    } finally {
      setLoading(false)
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-brand"
      >
        <Pencil size={14} /> Bearbeiten
      </button>
    )
  }

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mt-4 space-y-3">
      <div>
        <label htmlFor="edit-title" className="block text-sm font-semibold text-slate-700 mb-1">Titel</label>
        <input
          id="edit-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          minLength={5}
          className="w-full border border-slate-300 rounded-lg px-4 py-2.5"
        />
      </div>
      <div>
        <label htmlFor="edit-description" className="block text-sm font-semibold text-slate-700 mb-1">Beschreibung</label>
        <textarea
          id="edit-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          minLength={20}
          rows={4}
          className="w-full border border-slate-300 rounded-lg px-4 py-2.5"
        />
      </div>
      <div>
        <label htmlFor="edit-deadline" className="block text-sm font-semibold text-slate-700 mb-1">Wunschtermin</label>
        <input
          id="edit-deadline"
          type="date"
          value={deadline}
          onChange={(e) => setDeadline(e.target.value)}
          min={new Date().toISOString().split('T')[0]}
          className="w-full sm:w-64 border border-slate-300 rounded-lg px-4 py-2.5"
        />
      </div>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-3">
        <button
          onClick={handleSave}
          disabled={loading}
          className="bg-[#17202a] hover:bg-[#232f3b] disabled:opacity-50 text-white font-bold py-2 px-5 rounded-lg text-sm"
        >
          {loading ? 'Wird gespeichert…' : 'Speichern'}
        </button>
        <button onClick={() => setOpen(false)} className="text-slate-500 text-sm font-medium">Abbrechen</button>
      </div>
    </div>
  )
}

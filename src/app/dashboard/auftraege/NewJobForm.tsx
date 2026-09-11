'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Sparkles, Trash2, Plus } from 'lucide-react'
import { GEWERKE } from '@/lib/gewerke'

interface DraftLineItem {
  gewerk: string
  title: string
  description: string
}

type Phase = 'closed' | 'describe' | 'review'

export default function NewJobForm({ disabled }: { disabled: boolean }) {
  const router = useRouter()
  const [phase, setPhase] = useState<Phase>('closed')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [title, setTitle] = useState('')
  const [gewerk, setGewerk] = useState('')
  const [plz, setPlz] = useState('')
  const [ort, setOrt] = useState('')
  const [description, setDescription] = useState('')
  const [deadline, setDeadline] = useState('')
  const [lineItems, setLineItems] = useState<DraftLineItem[]>([])

  async function handleGenerateLV() {
    setError('')
    if (description.trim().length < 20) {
      setError('Bitte beschreiben Sie Ihr Projekt etwas ausführlicher (mind. 20 Zeichen).')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/jobs/generate-lv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Leistungsverzeichnis konnte nicht erstellt werden.')
      setLineItems(json.items.map((i: DraftLineItem) => ({ ...i, description: i.description || '' })))
      setPhase('review')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler')
    } finally {
      setLoading(false)
    }
  }

  function updateLineItem(index: number, patch: Partial<DraftLineItem>) {
    setLineItems((prev) => prev.map((li, i) => (i === index ? { ...li, ...patch } : li)))
  }

  function removeLineItem(index: number) {
    setLineItems((prev) => prev.filter((_, i) => i !== index))
  }

  function addLineItem() {
    setLineItems((prev) => [...prev, { gewerk: GEWERKE[0], title: '', description: '' }])
  }

  async function handlePublish(withLineItems: boolean) {
    if (!title || !gewerk || !plz || !ort || description.trim().length < 20) {
      setError('Bitte füllen Sie Titel, Gewerk, PLZ, Ort und eine ausführliche Beschreibung aus.')
      setPhase('describe')
      return
    }
    setLoading(true)
    setError('')

    const body = {
      title,
      gewerk,
      plz,
      ort,
      description,
      deadline: deadline || undefined,
      lineItems: withLineItems ? lineItems.filter((li) => li.title.trim().length > 0) : undefined,
    }

    try {
      const res = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Auftrag konnte nicht erstellt werden.')
      setPhase('closed')
      setTitle(''); setGewerk(''); setPlz(''); setOrt(''); setDescription(''); setDeadline(''); setLineItems([])
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler')
    } finally {
      setLoading(false)
    }
  }

  if (phase === 'closed') {
    return (
      <button
        onClick={() => setPhase('describe')}
        disabled={disabled}
        className="bg-[#17202a] hover:bg-[#232f3b] disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-lg transition"
      >
        + Neuen Auftrag einstellen
      </button>
    )
  }

  if (phase === 'describe') {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4 mb-8">
        <h3 className="font-bold text-lg text-[#17202a]">Neuer Auftrag</h3>

        <div>
          <label htmlFor="title" className="block text-sm font-semibold text-slate-700 mb-1">Titel *</label>
          <input id="title" value={title} onChange={(e) => setTitle(e.target.value)} required minLength={5} className="w-full border border-slate-300 rounded-lg px-4 py-2.5" />
        </div>

        <div className="grid sm:grid-cols-3 gap-4">
          <div>
            <label htmlFor="gewerk" className="block text-sm font-semibold text-slate-700 mb-1">Hauptgewerk *</label>
            <select id="gewerk" value={gewerk} onChange={(e) => setGewerk(e.target.value)} required className="w-full border border-slate-300 rounded-lg px-4 py-2.5 bg-white">
              <option value="" disabled>Bitte wählen</option>
              {GEWERKE.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="plz" className="block text-sm font-semibold text-slate-700 mb-1">PLZ *</label>
            <input id="plz" value={plz} onChange={(e) => setPlz(e.target.value)} required className="w-full border border-slate-300 rounded-lg px-4 py-2.5" />
          </div>
          <div>
            <label htmlFor="ort" className="block text-sm font-semibold text-slate-700 mb-1">Ort *</label>
            <input id="ort" value={ort} onChange={(e) => setOrt(e.target.value)} required className="w-full border border-slate-300 rounded-lg px-4 py-2.5" />
          </div>
        </div>

        <div>
          <label htmlFor="description" className="block text-sm font-semibold text-slate-700 mb-1">
            Projektbeschreibung * <span className="font-normal text-slate-400">– je genauer, desto besser das KI-Leistungsverzeichnis</span>
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            minLength={20}
            rows={4}
            placeholder="Beispiel: Ich möchte meine 120 m² Wohnung komplett renovieren. Neue Elektrik, neues Bad, neuer Boden im Wohnzimmer und Schlafzimmer, alle Wände streichen."
            className="w-full border border-slate-300 rounded-lg px-4 py-2.5"
          />
        </div>

        <div>
          <label htmlFor="deadline" className="block text-sm font-semibold text-slate-700 mb-1">Wunschtermin</label>
          <input id="deadline" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} min={new Date().toISOString().split('T')[0]} className="w-full sm:w-64 border border-slate-300 rounded-lg px-4 py-2.5" />
        </div>

        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}

        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleGenerateLV}
            disabled={loading}
            className="bg-[#f47b20] hover:bg-[#e06c14] disabled:opacity-50 text-white font-bold py-2.5 px-6 rounded-lg flex items-center gap-2"
          >
            <Sparkles size={18} /> {loading ? 'Wird erstellt…' : 'Leistungsverzeichnis mit KI erstellen'}
          </button>
          <button
            onClick={() => handlePublish(false)}
            disabled={loading}
            className="text-slate-500 font-semibold text-sm px-2"
          >
            Ohne Leistungsverzeichnis veröffentlichen
          </button>
          <button type="button" onClick={() => setPhase('closed')} className="text-slate-400 text-sm px-2">Abbrechen</button>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4 mb-8">
      <div className="flex items-center gap-2">
        <Sparkles size={18} className="text-[#f47b20]" />
        <h3 className="font-bold text-lg text-[#17202a]">KI-Leistungsverzeichnis prüfen & anpassen</h3>
      </div>
      <p className="text-sm text-slate-500">
        So erhalten alle Fachbetriebe denselben Leistungsumfang – ihre Angebote werden dadurch direkt vergleichbar.
      </p>

      <div className="space-y-3">
        {lineItems.map((li, i) => (
          <div key={i} className="border border-slate-200 rounded-lg p-4">
            <div className="grid sm:grid-cols-[1fr_2fr_auto] gap-3 mb-2">
              <select
                value={li.gewerk}
                onChange={(e) => updateLineItem(i, { gewerk: e.target.value })}
                className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
              >
                {GEWERKE.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
              <input
                value={li.title}
                onChange={(e) => updateLineItem(i, { title: e.target.value })}
                placeholder="Titel der Position"
                className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
              />
              <button onClick={() => removeLineItem(i)} aria-label="Position entfernen" className="text-slate-400 hover:text-red-600 px-2">
                <Trash2 size={18} />
              </button>
            </div>
            <textarea
              value={li.description}
              onChange={(e) => updateLineItem(i, { description: e.target.value })}
              rows={2}
              placeholder="Kurze Beschreibung des Leistungsumfangs"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
        ))}
      </div>

      <button onClick={addLineItem} className="flex items-center gap-1 text-sm font-semibold text-[#17202a] hover:underline">
        <Plus size={16} /> Position hinzufügen
      </button>

      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-3 pt-2 border-t border-slate-100">
        <button
          onClick={() => handlePublish(true)}
          disabled={loading || lineItems.length === 0}
          className="bg-[#17202a] hover:bg-[#232f3b] disabled:opacity-50 text-white font-bold py-2.5 px-6 rounded-lg"
        >
          {loading ? 'Wird veröffentlicht…' : 'Auftrag mit Leistungsverzeichnis veröffentlichen'}
        </button>
        <button type="button" onClick={() => setPhase('describe')} className="text-slate-500 font-medium px-4">
          ← Zurück
        </button>
      </div>
    </div>
  )
}

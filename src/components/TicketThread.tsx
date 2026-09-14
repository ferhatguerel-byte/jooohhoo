'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export interface TicketMessage {
  id: string
  senderName: string
  isAdmin: boolean
  body: string
  createdAt: string
}

export default function TicketThread({
  ticketId,
  messages,
  status,
  isAdmin,
}: {
  ticketId: string
  messages: TicketMessage[]
  status: 'open' | 'closed'
  isAdmin: boolean
}) {
  const router = useRouter()
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim()) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/support/tickets/${ticketId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Nachricht konnte nicht gesendet werden.')
      setText('')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler')
    } finally {
      setLoading(false)
    }
  }

  async function setStatus(next: 'open' | 'closed') {
    setLoading(true)
    try {
      await fetch(`/api/support/tickets/${ticketId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      })
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6">
      <div className="space-y-3 mb-4 max-h-[28rem] overflow-y-auto">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`text-sm rounded-lg px-3.5 py-2.5 max-w-[85%] ${
              m.isAdmin ? 'bg-slate-100 text-slate-700' : 'bg-brand text-white ml-auto'
            }`}
          >
            <div className={`text-[10px] mb-0.5 ${m.isAdmin ? 'text-slate-400' : 'text-white/70'}`}>
              {m.isAdmin ? `Support · ${m.senderName}` : m.senderName} · {new Date(m.createdAt).toLocaleString('de-DE')}
            </div>
            <div className="whitespace-pre-wrap">{m.body}</div>
          </div>
        ))}
      </div>

      {status === 'closed' ? (
        <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg px-4 py-3">
          <p className="text-sm text-slate-500">Dieses Ticket ist geschlossen.</p>
          <button onClick={() => setStatus('open')} disabled={loading} className="text-sm font-semibold text-brand hover:underline">
            Erneut öffnen
          </button>
        </div>
      ) : (
        <>
          <form onSubmit={handleSend} className="flex gap-2">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Nachricht schreiben…"
              rows={2}
              className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm resize-none"
            />
            <button
              type="submit"
              disabled={loading}
              className="bg-brand hover:bg-brand-hover disabled:opacity-50 text-white text-sm font-bold px-4 rounded-lg"
            >
              Senden
            </button>
          </form>
          {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
          {!isAdmin && (
            <button onClick={() => setStatus('closed')} disabled={loading} className="text-xs font-semibold text-slate-400 hover:text-slate-600 mt-3">
              Ticket als erledigt schließen
            </button>
          )}
        </>
      )}
    </div>
  )
}

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { MessageCircle } from 'lucide-react'

export interface ChatMessage {
  id: string
  senderId: string
  senderName: string
  body: string
  createdAt: string
}

export default function OfferChat({
  offerId,
  messages,
  currentUserId,
}: {
  offerId: string
  messages: ChatMessage[]
  currentUserId: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(messages.length > 0)
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim()) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/offers/${offerId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Nachricht konnte nicht gesendet werden.')
      setText('')
      setOpen(true)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mt-4 pt-4 border-t border-slate-100">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="text-xs font-semibold text-brand hover:underline flex items-center gap-1"
      >
        <MessageCircle size={14} /> Nachrichten{messages.length > 0 ? ` (${messages.length})` : ''}
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {messages.length === 0 && <p className="text-xs text-slate-400">Noch keine Nachrichten.</p>}
            {messages.map((m) => (
              <div
                key={m.id}
                className={`text-sm rounded-lg px-3 py-2 max-w-[85%] ${
                  m.senderId === currentUserId ? 'bg-brand text-white ml-auto' : 'bg-slate-100 text-slate-700'
                }`}
              >
                <div className={`text-[10px] mb-0.5 ${m.senderId === currentUserId ? 'text-white/70' : 'text-slate-400'}`}>
                  {m.senderName} · {new Date(m.createdAt).toLocaleString('de-DE')}
                </div>
                <div className="whitespace-pre-wrap">{m.body}</div>
              </div>
            ))}
          </div>
          <form onSubmit={handleSend} className="flex gap-2">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Nachricht schreiben…"
              className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm"
            />
            <button
              type="submit"
              disabled={loading}
              className="bg-brand hover:bg-brand-hover disabled:opacity-50 text-white text-sm font-bold px-4 rounded-lg"
            >
              Senden
            </button>
          </form>
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
      )}
    </div>
  )
}

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function VerifyActions({
  userId,
  meisterpflichtigeGewerke,
}: {
  userId: string
  meisterpflichtigeGewerke: string[]
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<string[]>([])

  function toggle(gewerk: string) {
    setSelected((prev) => (prev.includes(gewerk) ? prev.filter((g) => g !== gewerk) : [...prev, gewerk]))
  }

  async function setStatus(status: 'verified' | 'rejected') {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, status, verifiedGewerke: selected }),
      })
      if (!res.ok) throw new Error()
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      {meisterpflichtigeGewerke.length > 0 && (
        <div className="text-right">
          <p className="text-xs font-semibold text-slate-500 mb-1">
            Für welche meisterpflichtigen Gewerke liegt ein gültiger Meisterbrief/Qualifikationsnachweis vor?
          </p>
          <div className="flex flex-wrap gap-2 justify-end">
            {meisterpflichtigeGewerke.map((g) => (
              <label key={g} className="flex items-center gap-1.5 text-xs font-medium text-slate-700 border border-slate-200 rounded-full px-2.5 py-1 cursor-pointer">
                <input type="checkbox" checked={selected.includes(g)} onChange={() => toggle(g)} />
                {g}
              </label>
            ))}
          </div>
        </div>
      )}
      <div className="flex gap-2">
        <button
          onClick={() => setStatus('verified')}
          disabled={loading}
          className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-bold py-2 px-4 rounded-lg"
        >
          Verifizieren
        </button>
        <button
          onClick={() => setStatus('rejected')}
          disabled={loading}
          className="bg-red-50 hover:bg-red-100 disabled:opacity-50 text-red-700 text-sm font-bold py-2 px-4 rounded-lg"
        >
          Ablehnen
        </button>
      </div>
    </div>
  )
}

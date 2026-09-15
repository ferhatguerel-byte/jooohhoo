'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function VerifyActions({ userId }: { userId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function setStatus(status: 'verified' | 'rejected') {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, status }),
      })
      if (!res.ok) throw new Error()
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
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
  )
}

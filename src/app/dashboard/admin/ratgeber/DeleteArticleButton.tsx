'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function DeleteArticleButton({ articleId }: { articleId: string }) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleDelete() {
    setLoading(true)
    try {
      await fetch(`/api/admin/guide-articles/${articleId}`, { method: 'DELETE' })
      router.refresh()
    } finally {
      setLoading(false)
      setConfirming(false)
    }
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <button onClick={handleDelete} disabled={loading} className="text-sm font-semibold text-red-600 hover:underline">
          {loading ? 'Löschen…' : 'Wirklich löschen?'}
        </button>
        <button onClick={() => setConfirming(false)} className="text-sm text-slate-400">Abbrechen</button>
      </div>
    )
  }

  return (
    <button onClick={() => setConfirming(true)} className="text-sm font-semibold text-slate-400 hover:text-red-600">
      Löschen
    </button>
  )
}

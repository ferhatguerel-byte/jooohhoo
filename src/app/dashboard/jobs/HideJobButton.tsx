'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2, RotateCcw } from 'lucide-react'

export default function HideJobButton({ jobId, hidden }: { jobId: string; hidden: boolean }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleClick() {
    setLoading(true)
    try {
      await fetch(`/api/jobs/${jobId}/hide`, { method: hidden ? 'DELETE' : 'POST' })
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      title={hidden ? 'Wieder einblenden' : 'Auftrag nicht interessant – ausblenden'}
      className="text-xs font-semibold text-slate-400 hover:text-slate-700 disabled:opacity-50 flex items-center gap-1"
    >
      {hidden ? <RotateCcw size={14} /> : <Trash2 size={14} />}
      {hidden ? 'Einblenden' : 'Ausblenden'}
    </button>
  )
}

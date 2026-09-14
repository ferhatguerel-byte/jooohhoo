'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search } from 'lucide-react'

export default function NutzerSearch({ initialQuery }: { initialQuery: string }) {
  const router = useRouter()
  const [q, setQ] = useState(initialQuery)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    router.push(q ? `/dashboard/admin/nutzer?q=${encodeURIComponent(q)}` : '/dashboard/admin/nutzer')
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 max-w-md">
      <div className="relative flex-1">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Firmenname oder E-Mail suchen…"
          className="w-full border border-slate-300 rounded-lg pl-9 pr-3 py-2 text-sm"
        />
      </div>
      <button type="submit" className="bg-[#17202a] hover:bg-slate-800 text-white text-sm font-bold px-4 rounded-lg">
        Suchen
      </button>
    </form>
  )
}

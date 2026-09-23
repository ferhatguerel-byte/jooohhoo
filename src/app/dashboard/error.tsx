'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { captureError } from '@/lib/observability/sentry'

export default function DashboardErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('Dashboard-Fehler:', error)
    captureError(error, { route: 'dashboard', extra: { digest: error.digest ?? null } })
  }, [error])

  return (
    <div className="flex items-center justify-center py-20 px-6">
      <div className="bg-white border border-slate-200 rounded-2xl p-8 max-w-md text-center">
        <div className="text-4xl mb-4">⚠️</div>
        <h1 className="text-xl font-black text-slate-900 mb-2">Etwas ist schiefgelaufen</h1>
        <p className="text-slate-500 mb-6">
          Diese Seite konnte nicht geladen werden. Versuchen Sie es erneut, oder wenden Sie sich an unseren Support,
          falls das Problem bestehen bleibt.
        </p>
        <div className="flex items-center justify-center gap-3">
          <button onClick={reset} className="bg-brand hover:bg-brand-hover text-white font-bold py-2.5 px-5 rounded-lg">
            Erneut versuchen
          </button>
          <Link href="/dashboard/support" className="border border-slate-300 hover:border-slate-400 text-slate-700 font-bold py-2.5 px-5 rounded-lg">
            Support kontaktieren
          </Link>
        </div>
      </div>
    </div>
  )
}

'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { captureError } from '@/lib/observability/sentry'

export default function GlobalErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('Unerwarteter Fehler:', error)
    // Phase 4.4 (Teil C/B): auch clientseitig ausgelöste, bis hierher durchgereichte Fehler
    // gehen ans zentrale Error-Tracking (No-op ohne SENTRY_DSN). `digest` ist Next.js' eigene,
    // bereits anonymisierte Kennung für serverseitig entstandene Fehler.
    captureError(error, { extra: { digest: error.digest ?? null } })
  }, [error])

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-6">
      <div className="bg-white border border-slate-200 rounded-2xl p-8 max-w-md text-center">
        <div className="text-4xl mb-4">⚠️</div>
        <h1 className="text-xl font-black text-slate-900 mb-2">Etwas ist schiefgelaufen</h1>
        <p className="text-slate-500 mb-6">
          Es gab ein unerwartetes Problem beim Laden dieser Seite. Bitte versuchen Sie es erneut, oder kehren Sie
          zur Startseite zurück.
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="bg-brand hover:bg-brand-hover text-white font-bold py-2.5 px-5 rounded-lg"
          >
            Erneut versuchen
          </button>
          <Link href="/" className="border border-slate-300 hover:border-slate-400 text-slate-700 font-bold py-2.5 px-5 rounded-lg">
            Zur Startseite
          </Link>
        </div>
      </div>
    </div>
  )
}

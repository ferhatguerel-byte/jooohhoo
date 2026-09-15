'use client'

import { useEffect } from 'react'

export default function GlobalRootError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('Kritischer Fehler:', error)
  }, [error])

  return (
    <html lang="de">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif', background: '#f8fafc' }}>
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 16, padding: 32, maxWidth: 420, textAlign: 'center' }}>
            <div style={{ fontSize: 36, marginBottom: 16 }}>⚠️</div>
            <h1 style={{ fontSize: 20, fontWeight: 900, color: '#0f172a', marginBottom: 8 }}>Etwas ist schiefgelaufen</h1>
            <p style={{ color: '#64748b', marginBottom: 24 }}>
              BAUVERSUS konnte gerade nicht geladen werden. Bitte versuchen Sie es erneut.
            </p>
            <button
              onClick={reset}
              style={{ background: '#f47b20', color: 'white', fontWeight: 700, padding: '10px 20px', borderRadius: 8, border: 'none', cursor: 'pointer' }}
            >
              Erneut versuchen
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}

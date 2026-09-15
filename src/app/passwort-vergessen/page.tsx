'use client'

import { useState } from 'react'
import Link from 'next/link'
import { HardHat, ArrowRight } from 'lucide-react'

export default function ForgotPasswordPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const form = new FormData(e.currentTarget)
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.get('email') }),
      })
      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error || 'Anfrage fehlgeschlagen.')
      }
      setSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <Link href="/" className="flex items-center gap-2 font-black text-xl text-slate-900 justify-center mb-8">
          <span className="bg-brand text-white rounded-lg w-9 h-9 flex items-center justify-center">
            <HardHat size={18} />
          </span>
          BAU<span className="text-accent">VERSUS</span>
        </Link>

        <div className="bg-white border border-slate-200 rounded-2xl p-6 md:p-8 shadow-sm">
          <h1 className="text-2xl font-black text-slate-900 mb-2 text-center">Passwort vergessen</h1>

          {sent ? (
            <p className="text-sm text-slate-600 text-center mt-4">
              Falls diese E-Mail-Adresse bei uns registriert ist, haben wir Ihnen einen Link zum Zurücksetzen
              des Passworts geschickt. Bitte prüfen Sie Ihr Postfach (auch den Spam-Ordner).
            </p>
          ) : (
            <>
              <p className="text-sm text-slate-500 text-center mb-6">
                Geben Sie Ihre E-Mail-Adresse ein, wir schicken Ihnen einen Link zum Zurücksetzen.
              </p>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="email" className="block text-sm font-semibold text-slate-700 mb-1">E-Mail</label>
                  <input id="email" name="email" type="email" required className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand" />
                </div>

                {error && <p role="alert" className="text-sm text-red-600">{error}</p>}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-brand hover:bg-brand-hover disabled:opacity-50 text-white font-bold py-3.5 rounded-lg transition flex items-center justify-center gap-2"
                >
                  {loading ? 'Wird gesendet…' : 'Link zusenden'} <ArrowRight size={18} />
                </button>
              </form>
            </>
          )}

          <p className="text-sm text-slate-500 text-center mt-6">
            <Link href="/login" className="text-brand font-semibold hover:underline">Zurück zur Anmeldung</Link>
          </p>
        </div>
      </div>
    </div>
  )
}

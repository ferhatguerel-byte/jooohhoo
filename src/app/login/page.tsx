'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { HardHat, ArrowRight } from 'lucide-react'
import SiteFooter from '@/components/layout/SiteFooter'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const justReset = searchParams.get('reset') === '1'
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const form = new FormData(e.currentTarget)
    const body = { email: form.get('email'), password: form.get('password') }

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Login fehlgeschlagen.')
      router.push('/dashboard')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
    <div className="flex-1 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <Link href="/" className="flex items-center gap-2 font-black text-xl text-slate-900 justify-center mb-8">
          <span className="bg-brand text-white rounded-lg w-9 h-9 flex items-center justify-center">
            <HardHat size={18} />
          </span>
          BAU<span className="text-accent">VERSUS</span>
        </Link>

        <div className="bg-white border border-slate-200 rounded-2xl p-6 md:p-8 shadow-sm">
          <h1 className="text-2xl font-black text-slate-900 mb-6 text-center">Anmelden</h1>

          {justReset && (
            <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2 mb-4 text-center">
              Passwort erfolgreich geändert. Bitte melden Sie sich mit dem neuen Passwort an.
            </p>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-slate-700 mb-1">E-Mail</label>
              <input id="email" name="email" type="email" required className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand" />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="password" className="block text-sm font-semibold text-slate-700">Passwort</label>
                <Link href="/passwort-vergessen" className="text-xs text-brand font-semibold hover:underline">Passwort vergessen?</Link>
              </div>
              <input id="password" name="password" type="password" required className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand" />
            </div>

            {error && <p role="alert" className="text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-brand hover:bg-brand-hover disabled:opacity-50 text-white font-bold py-3.5 rounded-lg transition flex items-center justify-center gap-2"
            >
              {loading ? 'Wird geprüft…' : 'Anmelden'} <ArrowRight size={18} />
            </button>
          </form>

          <p className="text-sm text-slate-500 text-center mt-6">
            Noch kein Konto?{' '}
            <Link href="/registrieren" className="text-brand font-semibold hover:underline">Jetzt registrieren</Link>
          </p>
        </div>
      </div>
    </div>
    <SiteFooter />
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}

'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { HardHat, ArrowRight } from 'lucide-react'
import SiteFooter from '@/components/layout/SiteFooter'

function ResetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token') || ''
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const form = new FormData(e.currentTarget)
    const password = form.get('password') as string
    const passwordConfirm = form.get('passwordConfirm') as string

    if (password !== passwordConfirm) {
      setError('Die Passwörter stimmen nicht überein.')
      setLoading(false)
      return
    }

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Passwort konnte nicht zurückgesetzt werden.')
      router.push('/login?reset=1')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler')
      setLoading(false)
    }
  }

  if (!token) {
    return (
      <p className="text-sm text-red-600 text-center">
        Kein gültiger Link. Bitte fordern Sie über{' '}
        <Link href="/passwort-vergessen" className="text-brand font-semibold hover:underline">Passwort vergessen</Link>{' '}
        einen neuen Link an.
      </p>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="password" className="block text-sm font-semibold text-slate-700 mb-1">Neues Passwort</label>
        <input id="password" name="password" type="password" required minLength={8} className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand" />
      </div>
      <div>
        <label htmlFor="passwordConfirm" className="block text-sm font-semibold text-slate-700 mb-1">Passwort bestätigen</label>
        <input id="passwordConfirm" name="passwordConfirm" type="password" required minLength={8} className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand" />
      </div>

      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-brand hover:bg-brand-hover disabled:opacity-50 text-white font-bold py-3.5 rounded-lg transition flex items-center justify-center gap-2"
      >
        {loading ? 'Wird gespeichert…' : 'Neues Passwort speichern'} <ArrowRight size={18} />
      </button>
    </form>
  )
}

export default function ResetPasswordPage() {
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
          <h1 className="text-2xl font-black text-slate-900 mb-6 text-center">Neues Passwort vergeben</h1>
          <Suspense>
            <ResetPasswordForm />
          </Suspense>
        </div>
      </div>
    </div>
    <SiteFooter />
    </div>
  )
}

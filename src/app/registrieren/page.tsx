'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { HardHat, ArrowRight } from 'lucide-react'
import { GEWERKE } from '@/lib/gewerke'

type Role = 'auftraggeber' | 'subunternehmer'

function RegisterForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialRole = searchParams.get('rolle') === 'subunternehmer' ? 'subunternehmer' : 'auftraggeber'

  const [role, setRole] = useState<Role>(initialRole)
  const [gewerke, setGewerke] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function toggleGewerk(g: string) {
    setGewerke((prev) => (prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]))
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const form = new FormData(e.currentTarget)
    const body = {
      role,
      companyName: form.get('companyName'),
      email: form.get('email'),
      password: form.get('password'),
      phone: form.get('phone'),
      plz: form.get('plz'),
      ort: form.get('ort'),
      gewerke: role === 'subunternehmer' ? gewerke : undefined,
    }

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Registrierung fehlgeschlagen.')
      router.push('/dashboard')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">
        <Link href="/" className="flex items-center gap-2 font-black text-xl text-slate-900 justify-center mb-8">
          <span className="bg-brand text-white rounded-lg w-9 h-9 flex items-center justify-center">
            <HardHat size={18} />
          </span>
          BAU<span className="text-accent">CONNECT</span>
        </Link>

        <div className="bg-white border border-slate-200 rounded-2xl p-6 md:p-8 shadow-sm">
          <h1 className="text-2xl font-black text-slate-900 mb-6 text-center">Kostenlos registrieren</h1>

          <div className="grid grid-cols-2 gap-2 mb-6 bg-slate-100 rounded-lg p-1">
            <button
              type="button"
              onClick={() => setRole('auftraggeber')}
              className={`py-2.5 rounded-md text-sm font-bold transition ${role === 'auftraggeber' ? 'bg-white shadow text-brand' : 'text-slate-500'}`}
            >
              Ich bin Auftraggeber
            </button>
            <button
              type="button"
              onClick={() => setRole('subunternehmer')}
              className={`py-2.5 rounded-md text-sm font-bold transition ${role === 'subunternehmer' ? 'bg-white shadow text-accent' : 'text-slate-500'}`}
            >
              Ich bin Subunternehmer
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="companyName" className="block text-sm font-semibold text-slate-700 mb-1">Firmenname *</label>
              <input id="companyName" name="companyName" required className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand" />
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="email" className="block text-sm font-semibold text-slate-700 mb-1">E-Mail *</label>
                <input id="email" name="email" type="email" required className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand" />
              </div>
              <div>
                <label htmlFor="password" className="block text-sm font-semibold text-slate-700 mb-1">Passwort *</label>
                <input id="password" name="password" type="password" required minLength={8} className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand" />
              </div>
            </div>

            <div className="grid sm:grid-cols-3 gap-4">
              <div>
                <label htmlFor="phone" className="block text-sm font-semibold text-slate-700 mb-1">Telefon</label>
                <input id="phone" name="phone" type="tel" className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand" />
              </div>
              <div>
                <label htmlFor="plz" className="block text-sm font-semibold text-slate-700 mb-1">PLZ *</label>
                <input id="plz" name="plz" required className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand" />
              </div>
              <div>
                <label htmlFor="ort" className="block text-sm font-semibold text-slate-700 mb-1">Ort *</label>
                <input id="ort" name="ort" required className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand" />
              </div>
            </div>

            {role === 'subunternehmer' && (
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Ihre Gewerke *</label>
                <div className="flex flex-wrap gap-2">
                  {GEWERKE.map((g) => (
                    <button
                      type="button"
                      key={g}
                      onClick={() => toggleGewerk(g)}
                      className={`px-3 py-1.5 rounded-full text-sm border transition ${
                        gewerke.includes(g)
                          ? 'bg-accent border-accent text-white'
                          : 'border-slate-300 text-slate-600 hover:border-slate-400'
                      }`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {error && <p role="alert" className="text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={loading || (role === 'subunternehmer' && gewerke.length === 0)}
              className="w-full bg-brand hover:bg-brand-hover disabled:opacity-50 text-white font-bold py-3.5 rounded-lg transition flex items-center justify-center gap-2"
            >
              {loading ? 'Wird erstellt…' : 'Konto erstellen'} <ArrowRight size={18} />
            </button>
          </form>

          <p className="text-sm text-slate-500 text-center mt-6">
            Bereits registriert?{' '}
            <Link href="/login" className="text-brand font-semibold hover:underline">Jetzt anmelden</Link>
          </p>
        </div>
      </div>
    </div>
  )
}

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterForm />
    </Suspense>
  )
}

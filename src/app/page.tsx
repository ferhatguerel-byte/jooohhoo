'use client'

import { useState } from 'react'
import { Check, Zap, Shield, TrendingUp, Star, ArrowRight, Users, Euro } from 'lucide-react'

const PLANS = [
  {
    name: 'Starter',
    price: 29,
    priceId: 'starter',
    features: ['5 Projekte', '10GB Speicher', 'E-Mail Support', 'API Zugang'],
    popular: false,
  },
  {
    name: 'Pro',
    price: 79,
    priceId: 'pro',
    features: ['Unbegrenzte Projekte', '100GB Speicher', 'Priority Support', 'API Zugang', 'Automatisierungen', 'Analytics Dashboard'],
    popular: true,
  },
  {
    name: 'Enterprise',
    price: 199,
    priceId: 'enterprise',
    features: ['Alles in Pro', 'Dedizierter Manager', 'SLA Garantie', 'Custom Integrationen', 'White-Label Option', 'Team Management'],
    popular: false,
  },
]

const TESTIMONIALS = [
  { name: 'Marcus K.', role: 'CEO, TechStart GmbH', text: 'Innerhalb von 3 Monaten haben wir unseren Umsatz verdoppelt. Unglaublich effizient!', stars: 5 },
  { name: 'Sarah M.', role: 'Freelance Designerin', text: 'Endlich ein Tool das wirklich funktioniert. Spare täglich 2 Stunden Arbeit.', stars: 5 },
  { name: 'Tom B.', role: 'E-Commerce Unternehmer', text: 'ROI nach 2 Wochen. Die Automatisierungen sind Gold wert.', stars: 5 },
]

export default function HomePage() {
  const [loading, setLoading] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null)

  const handleCheckout = async (planId: string) => {
    if (!email || !name) {
      setSelectedPlan(planId)
      document.getElementById('checkout-form')?.scrollIntoView({ behavior: 'smooth' })
      return
    }

    setLoading(planId)
    const ref = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('ref') || '' : ''
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId, email, name, ref }),
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        alert('Fehler: ' + (data.error || 'Unbekannter Fehler'))
      }
    } catch (e: unknown) {
      alert('Netzwerkfehler: ' + (e instanceof Error ? e.message : String(e)))
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-violet-950 via-slate-900 to-slate-950 text-white">
      <nav className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
        <div className="text-2xl font-bold text-violet-400">AutoBusiness Pro</div>
        <a href="/dashboard/login" className="text-sm text-slate-400 hover:text-white transition">Login →</a>
      </nav>

      <section className="max-w-5xl mx-auto px-6 py-20 text-center">
        <div className="inline-flex items-center gap-2 bg-violet-900/50 border border-violet-700 rounded-full px-4 py-1 text-sm text-violet-300 mb-6">
          <Zap size={14} /> Über 2.847 aktive Nutzer
        </div>
        <h1 className="text-5xl md:text-7xl font-black mb-6 leading-tight">
          Dein Business läuft{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-cyan-400">automatisch</span>
        </h1>
        <p className="text-xl text-slate-300 mb-10 max-w-2xl mx-auto">
          Automatisiere deine Geschäftsprozesse, generiere wiederkehrende Einnahmen und spare täglich Stunden an Arbeit – komplett ohne technisches Wissen.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })}
            className="bg-violet-600 hover:bg-violet-500 text-white font-bold py-4 px-8 rounded-xl text-lg transition-all transform hover:scale-105 flex items-center justify-center gap-2"
          >
            Jetzt starten <ArrowRight size={20} />
          </button>
          <button
            onClick={() => document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })}
            className="border border-slate-600 hover:border-slate-400 text-slate-300 hover:text-white font-bold py-4 px-8 rounded-xl text-lg transition-all"
          >
            Wie es funktioniert
          </button>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-6 py-10">
        <div className="grid grid-cols-3 gap-6 text-center">
          {[
            { icon: <Users size={32} />, value: '2.847+', label: 'Aktive Nutzer' },
            { icon: <Euro size={32} />, value: '€1.2M+', label: 'Generierter Umsatz' },
            { icon: <TrendingUp size={32} />, value: '94%', label: 'Kundenzufriedenheit' },
          ].map((stat) => (
            <div key={stat.label} className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700">
              <div className="text-violet-400 flex justify-center mb-2">{stat.icon}</div>
              <div className="text-3xl font-black text-white">{stat.value}</div>
              <div className="text-slate-400 text-sm">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      <section id="how-it-works" className="max-w-5xl mx-auto px-6 py-20">
        <h2 className="text-4xl font-black text-center mb-4">So einfach funktioniert es</h2>
        <p className="text-slate-400 text-center mb-12">In 3 Schritten zum automatisierten Business</p>
        <div className="grid md:grid-cols-3 gap-8">
          {[
            { step: '01', title: 'Registrieren', desc: 'Erstelle deinen Account in weniger als 2 Minuten.' },
            { step: '02', title: 'Konfigurieren', desc: 'Richte deine Automatisierungen ein. Der Assistent führt dich durch alles.' },
            { step: '03', title: 'Geld verdienen', desc: 'Das System arbeitet 24/7. Du siehst täglich neue Einnahmen im Dashboard.' },
          ].map((item) => (
            <div key={item.step} className="relative">
              <div className="text-8xl font-black text-slate-800 absolute -top-4 -left-2">{item.step}</div>
              <div className="relative z-10 pt-8">
                <h3 className="text-xl font-bold mb-3">{item.title}</h3>
                <p className="text-slate-400">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-6 py-10">
        <h2 className="text-4xl font-black text-center mb-12">Alles was du brauchst</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            { icon: <Zap />, title: 'Vollautomatisch', desc: 'Läuft 24/7 ohne dein Eingreifen. Verdiene auch im Schlaf.' },
            { icon: <Shield />, title: 'Sicher & DSGVO-konform', desc: 'Alle Daten auf deutschen Servern. Vollständig DSGVO-konform.' },
            { icon: <TrendingUp />, title: 'Analytics', desc: 'Echtzeit-Dashboard mit allen wichtigen Metriken.' },
            { icon: <Users />, title: 'Affiliate System', desc: 'Lass andere für dich verkaufen. 30% Provision automatisch.' },
            { icon: <Euro />, title: 'Automatische Zahlungen', desc: 'Stripe Integration. Zahlungen werden automatisch verarbeitet.' },
            { icon: <Star />, title: 'E-Mail Automatisierung', desc: 'Automatische Welcome-, Onboarding- und Upsell-E-Mails.' },
          ].map((f) => (
            <div key={f.title} className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 hover:border-violet-600 transition-all">
              <div className="text-violet-400 mb-3">{f.icon}</div>
              <h3 className="font-bold text-lg mb-2">{f.title}</h3>
              <p className="text-slate-400 text-sm">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-6 py-20">
        <h2 className="text-4xl font-black text-center mb-12">Was unsere Kunden sagen</h2>
        <div className="grid md:grid-cols-3 gap-6">
          {TESTIMONIALS.map((t) => (
            <div key={t.name} className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
              <div className="flex gap-1 mb-3">
                {Array.from({ length: t.stars }).map((_, i) => (
                  <Star key={i} size={16} className="fill-yellow-400 text-yellow-400" />
                ))}
              </div>
              <p className="text-slate-300 mb-4 italic">"{t.text}"</p>
              <div className="font-bold">{t.name}</div>
              <div className="text-slate-400 text-sm">{t.role}</div>
            </div>
          ))}
        </div>
      </section>

      <section id="pricing" className="max-w-5xl mx-auto px-6 py-20">
        <h2 className="text-4xl font-black text-center mb-4">Transparente Preise</h2>
        <p className="text-slate-400 text-center mb-12">Monatlich kündbar. Keine versteckten Kosten.</p>

        <div className="grid md:grid-cols-3 gap-6 mb-12">
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              className={`rounded-2xl p-8 border-2 relative ${plan.popular ? 'bg-violet-900/50 border-violet-500 shadow-lg shadow-violet-900/50' : 'bg-slate-800/50 border-slate-700'}`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-violet-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                  BELIEBTESTE WAHL
                </div>
              )}
              <div className="text-lg font-bold mb-1">{plan.name}</div>
              <div className="text-4xl font-black mb-1">€{plan.price}</div>
              <div className="text-slate-400 text-sm mb-6">/Monat</div>
              <ul className="space-y-3 mb-8">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm">
                    <Check size={16} className="text-violet-400 shrink-0" /> {f}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => handleCheckout(plan.priceId)}
                disabled={loading === plan.priceId}
                className={`w-full py-3 rounded-xl font-bold transition-all ${plan.popular ? 'bg-violet-600 hover:bg-violet-500 text-white' : 'bg-slate-700 hover:bg-slate-600 text-white'} disabled:opacity-50`}
              >
                {loading === plan.priceId ? 'Lädt...' : 'Jetzt starten'}
              </button>
            </div>
          ))}
        </div>

        {selectedPlan && (
          <div id="checkout-form" className="max-w-md mx-auto bg-slate-800/50 border border-violet-700 rounded-2xl p-8">
            <h3 className="text-xl font-bold mb-6 text-center">Deine Daten eingeben</h3>
            <div className="space-y-4">
              <input
                type="text"
                placeholder="Dein Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-3 text-white placeholder-slate-400 focus:outline-none focus:border-violet-500"
              />
              <input
                type="email"
                placeholder="Deine E-Mail Adresse"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-3 text-white placeholder-slate-400 focus:outline-none focus:border-violet-500"
              />
              <button
                onClick={() => handleCheckout(selectedPlan)}
                disabled={!email || !name || loading === selectedPlan}
                className="w-full bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-all"
              >
                {loading === selectedPlan ? 'Weiterleitung...' : `${PLANS.find(p => p.priceId === selectedPlan)?.name} Plan kaufen →`}
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="max-w-5xl mx-auto px-6 py-10">
        <div className="bg-gradient-to-r from-violet-900/50 to-cyan-900/50 border border-violet-700 rounded-3xl p-10 text-center">
          <div className="text-4xl mb-3">💰</div>
          <h2 className="text-3xl font-black mb-3">Verdiene 30% Provision</h2>
          <p className="text-slate-300 mb-6 max-w-lg mx-auto">
            Empfehle uns weiter und verdiene 30% auf jeden Kauf deiner Empfehlungen – lebenslang, automatisch ausgezahlt.
          </p>
          <button
            onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })}
            className="bg-violet-600 hover:bg-violet-500 text-white font-bold py-3 px-8 rounded-xl transition-all"
          >
            Affiliate werden →
          </button>
        </div>
      </section>

      <footer className="max-w-5xl mx-auto px-6 py-10 mt-10 border-t border-slate-800 text-center text-slate-500 text-sm">
        <p>© 2026 AutoBusiness Pro · <a href="/impressum" className="hover:text-white">Impressum</a> · <a href="/datenschutz" className="hover:text-white">Datenschutz</a> · <a href="/agb" className="hover:text-white">AGB</a></p>
      </footer>
    </div>
  )
}

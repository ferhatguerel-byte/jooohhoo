'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  Truck,
  Sparkles,
  HardHat,
  Phone,
  Mail,
  MapPin,
  CheckCircle,
  Clock,
  ShieldCheck,
  Star,
  ChevronDown,
  Menu,
  X,
  ArrowRight,
  BadgeCheck,
  Users,
} from 'lucide-react'

const SERVICES = [
  {
    icon: <Truck size={28} />,
    title: 'Umzüge',
    desc: 'Privat- und Firmenumzüge, deutschlandweit und international. Vom Kartonpacken bis zum Möbelaufbau – alles aus einer Hand.',
    points: ['Wohnungs- & Hausumzüge', 'Büro- & Firmenumzüge', 'Ein- und Auslagerung'],
  },
  {
    icon: <Truck size={28} className="rotate-90" />,
    title: 'Transporte',
    desc: 'Schnelle und zuverlässige Transporte für Möbel, Paletten und Sondergüter – auf Abruf oder als Fixtermin.',
    points: ['Möbeltransporte', 'Kurier- & Expressfahrten', 'Sperrgut & Sondertransporte'],
  },
  {
    icon: <Sparkles size={28} />,
    title: 'Reinigung',
    desc: 'Gründliche Endreinigung, Unterhaltsreinigung und Grundreinigung für Wohnungen, Büros und Neubauten.',
    points: ['Umzugs- & Endreinigung', 'Büro- & Praxisreinigung', 'Bauendreinigung'],
  },
  {
    icon: <HardHat size={28} />,
    title: 'Bau & Renovierung',
    desc: 'Renovierungen, Sanierungen und kleinere Bauarbeiten – termingerecht und in gewohnt sauberer Ausführung.',
    points: ['Maler- & Bodenarbeiten', 'Trockenbau & Sanierung', 'Renovierung nach Umzug'],
  },
]

const STATS = [
  { icon: <Users size={28} />, value: '1.200+', label: 'Zufriedene Kunden' },
  { icon: <Star size={28} />, value: '4,8/5', label: 'Durchschnittsbewertung' },
  { icon: <Clock size={28} />, value: '10+ Jahre', label: 'Erfahrung' },
  { icon: <MapPin size={28} />, value: 'DE-weit', label: 'Einsatzgebiet' },
]

const WHY_US = [
  { icon: <BadgeCheck size={22} />, title: 'Festpreis-Garantie', desc: 'Transparentes Angebot vorab – keine versteckten Kosten.' },
  { icon: <ShieldCheck size={22} />, title: 'Vollständig versichert', desc: 'Transport- und Betriebshaftpflicht für Ihre Sicherheit.' },
  { icon: <Users size={22} />, title: 'Erfahrenes Team', desc: 'Geschulte Fachkräfte für Umzug, Transport, Reinigung und Bau.' },
  { icon: <Clock size={22} />, title: 'Flexible Termine', desc: 'Auch kurzfristig, abends und am Wochenende möglich.' },
  { icon: <MapPin size={22} />, title: 'Deutschlandweit', desc: 'Wir sind in ganz Deutschland und grenznah im Einsatz.' },
  { icon: <CheckCircle size={22} />, title: 'Alles aus einer Hand', desc: 'Ein Ansprechpartner für alle Ihre Anliegen.' },
]

const STEPS = [
  { step: '01', title: 'Anfrage stellen', desc: 'Formular ausfüllen oder anrufen – wir melden uns innerhalb von 24 Stunden.' },
  { step: '02', title: 'Kostenloses Angebot', desc: 'Sie erhalten ein unverbindliches Festpreis-Angebot, bei Bedarf nach Vor-Ort-Besichtigung.' },
  { step: '03', title: 'Termin vereinbaren', desc: 'Wir stimmen einen für Sie passenden Termin ab – auch kurzfristig.' },
  { step: '04', title: 'Durchführung', desc: 'Unser Team führt den Auftrag zuverlässig, sauber und termingerecht aus.' },
]

const TESTIMONIALS = [
  { name: 'Familie Schneider', role: 'Umzug, München', text: 'Reibungsloser Ablauf, faires Festpreisangebot und sehr vorsichtiger Umgang mit unseren Möbeln. Absolute Empfehlung!', stars: 5 },
  { name: 'Anna K.', role: 'Büroreinigung, Berlin', text: 'Seit einem Jahr betreut RundumWerk24 unsere Praxisräume. Immer pünktlich, gründlich und zuverlässig.', stars: 5 },
  { name: 'Michael R.', role: 'Renovierung, Köln', text: 'Vom Boden bis zur Wand alles aus einer Hand organisiert. Termin wurde exakt eingehalten.', stars: 5 },
]

const FAQS = [
  { q: 'Wie schnell erhalte ich ein Angebot?', a: 'In der Regel innerhalb von 24 Stunden nach Ihrer Anfrage. Bei komplexeren Aufträgen vereinbaren wir vorab einen kurzen Vor-Ort- oder Video-Termin zur Besichtigung.' },
  { q: 'Sind die Preise wirklich Festpreise?', a: 'Ja. Nach der Besichtigung bzw. Angebotsklärung erhalten Sie einen verbindlichen Festpreis – ohne versteckte Zusatzkosten.' },
  { q: 'Bieten Sie auch kurzfristige Termine an?', a: 'Ja, je nach Kapazität sind auch kurzfristige und Wochenendtermine möglich. Sprechen Sie uns einfach an.' },
  { q: 'In welchen Regionen sind Sie aktiv?', a: 'Wir sind deutschlandweit im Einsatz, mit Schwerpunkt in Ballungsräumen sowie grenznahen Regionen zu Polen.' },
  { q: 'Ist mein Umzug/Transport versichert?', a: 'Ja, alle Aufträge sind über unsere Transport- und Betriebshaftpflichtversicherung abgesichert.' },
]

const SERVICE_OPTIONS = ['Umzug', 'Transport', 'Reinigung', 'Bau & Renovierung', 'Sonstiges']

type FormStatus = 'idle' | 'loading' | 'success' | 'error'

function Header() {
  const [open, setOpen] = useState(false)

  const scrollTo = (id: string) => {
    setOpen(false)
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
  }

  const links = [
    { id: 'leistungen', label: 'Leistungen' },
    { id: 'ablauf', label: 'Ablauf' },
    { id: 'referenzen', label: 'Referenzen' },
    { id: 'faq', label: 'FAQ' },
    { id: 'kontakt', label: 'Kontakt' },
  ]

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-slate-200">
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
        <a href="#top" className="flex items-center gap-2 font-black text-xl text-slate-900">
          <span className="bg-blue-900 text-white rounded-lg w-9 h-9 flex items-center justify-center">
            <HardHat size={18} />
          </span>
          RundumWerk<span className="text-orange-500">24</span>
        </a>

        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
          {links.map((l) => (
            <button key={l.id} onClick={() => scrollTo(l.id)} className="hover:text-blue-900 transition">
              {l.label}
            </button>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-4">
          <a href="tel:+4930123456789" className="flex items-center gap-2 text-sm font-semibold text-slate-700 hover:text-blue-900">
            <Phone size={16} /> 030 / 123 456 789
          </a>
          <button
            onClick={() => scrollTo('anfrage')}
            className="bg-orange-500 hover:bg-orange-400 text-white font-bold py-2.5 px-5 rounded-lg text-sm transition"
          >
            Kostenlose Anfrage
          </button>
        </div>

        <button className="md:hidden text-slate-700" onClick={() => setOpen(!open)} aria-label="Menü öffnen">
          {open ? <X size={26} /> : <Menu size={26} />}
        </button>
      </div>

      {open && (
        <div className="md:hidden border-t border-slate-200 px-6 py-4 flex flex-col gap-4 bg-white">
          {links.map((l) => (
            <button key={l.id} onClick={() => scrollTo(l.id)} className="text-left text-slate-700 font-medium">
              {l.label}
            </button>
          ))}
          <a href="tel:+4930123456789" className="flex items-center gap-2 text-slate-700 font-semibold">
            <Phone size={16} /> 030 / 123 456 789
          </a>
          <button
            onClick={() => scrollTo('anfrage')}
            className="bg-orange-500 text-white font-bold py-3 rounded-lg text-sm"
          >
            Kostenlose Anfrage
          </button>
        </div>
      )}
    </header>
  )
}

function QuoteForm() {
  const [status, setStatus] = useState<FormStatus>('idle')
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setStatus('loading')
    setError('')

    const form = e.currentTarget
    const data = Object.fromEntries(new FormData(form).entries())

    try {
      const res = await fetch('/api/anfrage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Unbekannter Fehler')
      setStatus('success')
      form.reset()
    } catch (err) {
      setStatus('error')
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler')
    }
  }

  if (status === 'success') {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center shadow-sm">
        <CheckCircle className="mx-auto text-green-600 mb-4" size={40} />
        <h3 className="text-xl font-bold text-slate-900 mb-2">Vielen Dank für Ihre Anfrage!</h3>
        <p className="text-slate-600">Wir melden uns in der Regel innerhalb von 24 Stunden mit einem unverbindlichen Angebot bei Ihnen.</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-2xl p-6 md:p-8 shadow-sm space-y-4">
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">Name *</label>
          <input name="name" required className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-900/30 focus:border-blue-900" />
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">Telefon</label>
          <input name="telefon" type="tel" className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-900/30 focus:border-blue-900" />
        </div>
      </div>

      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-1">E-Mail *</label>
        <input name="email" type="email" required className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-900/30 focus:border-blue-900" />
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">Leistung *</label>
          <select name="leistung" required defaultValue="" className="w-full border border-slate-300 rounded-lg px-4 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-900/30 focus:border-blue-900">
            <option value="" disabled>Bitte wählen</option>
            {SERVICE_OPTIONS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">Wunschtermin</label>
          <input name="termin" type="date" className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-900/30 focus:border-blue-900" />
        </div>
      </div>

      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-1">Nachricht</label>
        <textarea name="nachricht" rows={4} placeholder="Beschreiben Sie kurz Ihr Anliegen (z. B. Wohnungsgröße, Adresse von/nach, Umfang der Arbeiten)…" className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-900/30 focus:border-blue-900" />
      </div>

      {status === 'error' && <p className="text-sm text-red-600">Fehler: {error}</p>}

      <button
        type="submit"
        disabled={status === 'loading'}
        className="w-full bg-blue-900 hover:bg-blue-800 disabled:opacity-50 text-white font-bold py-3.5 rounded-lg transition flex items-center justify-center gap-2"
      >
        {status === 'loading' ? 'Wird gesendet…' : 'Unverbindliches Angebot anfordern'} <ArrowRight size={18} />
      </button>
      <p className="text-xs text-slate-400 text-center">Mit dem Absenden stimmen Sie unserer Datenschutzerklärung zu.</p>
    </form>
  )
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left font-semibold text-slate-900"
      >
        {q}
        <ChevronDown size={20} className={`shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="px-5 pb-4 text-slate-600 text-sm leading-relaxed">{a}</div>}
    </div>
  )
}

export default function HomePage() {
  return (
    <div id="top" className="min-h-screen bg-white text-slate-800">
      <Header />

      {/* Hero */}
      <section className="bg-gradient-to-b from-blue-950 to-blue-900 text-white">
        <div className="max-w-6xl mx-auto px-6 py-20 md:py-28 grid md:grid-cols-2 gap-12 items-center">
          <div>
            <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-1 text-sm mb-6">
              <ShieldCheck size={14} /> Versichert & mit Festpreis-Garantie
            </div>
            <h1 className="text-4xl md:text-5xl font-black leading-tight mb-6">
              Umzug, Transport, Reinigung & Bau –{' '}
              <span className="text-orange-400">alles aus einer Hand</span>
            </h1>
            <p className="text-lg text-blue-100 mb-8 max-w-xl">
              RundumWerk24 ist Ihr zuverlässiger Rundum-Dienstleister für Privat- und Geschäftskunden in ganz Deutschland. Ein Ansprechpartner, transparente Festpreise, saubere Ausführung.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <a
                href="#anfrage"
                className="bg-orange-500 hover:bg-orange-400 text-white font-bold py-3.5 px-7 rounded-lg text-center transition"
              >
                Kostenloses Angebot anfordern
              </a>
              <a
                href="#leistungen"
                className="border border-white/40 hover:border-white text-white font-bold py-3.5 px-7 rounded-lg text-center transition"
              >
                Unsere Leistungen
              </a>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {SERVICES.map((s) => (
              <div key={s.title} className="bg-white/10 border border-white/15 rounded-2xl p-5 backdrop-blur">
                <div className="text-orange-400 mb-2">{s.icon}</div>
                <div className="font-bold">{s.title}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-6 py-10 grid grid-cols-2 md:grid-cols-4 gap-6">
          {STATS.map((s) => (
            <div key={s.label} className="text-center">
              <div className="text-blue-900 flex justify-center mb-2">{s.icon}</div>
              <div className="text-2xl font-black text-slate-900">{s.value}</div>
              <div className="text-slate-500 text-sm">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Services */}
      <section id="leistungen" className="max-w-6xl mx-auto px-6 py-20">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <h2 className="text-3xl md:text-4xl font-black text-slate-900 mb-4">Unsere Leistungen</h2>
          <p className="text-slate-500">Vier Kernbereiche, ein Ansprechpartner – individuell kombinierbar für Ihr Projekt.</p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {SERVICES.map((s) => (
            <div key={s.title} className="border border-slate-200 rounded-2xl p-6 hover:border-blue-900/40 hover:shadow-md transition">
              <div className="text-blue-900 mb-4">{s.icon}</div>
              <h3 className="font-bold text-lg text-slate-900 mb-2">{s.title}</h3>
              <p className="text-slate-500 text-sm mb-4">{s.desc}</p>
              <ul className="space-y-1.5">
                {s.points.map((p) => (
                  <li key={p} className="flex items-center gap-2 text-sm text-slate-600">
                    <CheckCircle size={14} className="text-orange-500 shrink-0" /> {p}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* Why us */}
      <section className="bg-slate-50 border-y border-slate-200">
        <div className="max-w-6xl mx-auto px-6 py-20">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <h2 className="text-3xl md:text-4xl font-black text-slate-900 mb-4">Warum RundumWerk24?</h2>
            <p className="text-slate-500">Was uns von anderen Anbietern unterscheidet.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {WHY_US.map((w) => (
              <div key={w.title} className="flex gap-4 bg-white border border-slate-200 rounded-xl p-5">
                <div className="text-blue-900 shrink-0 bg-blue-50 rounded-lg w-11 h-11 flex items-center justify-center">{w.icon}</div>
                <div>
                  <div className="font-bold text-slate-900 mb-1">{w.title}</div>
                  <div className="text-sm text-slate-500">{w.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Process */}
      <section id="ablauf" className="max-w-6xl mx-auto px-6 py-20">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <h2 className="text-3xl md:text-4xl font-black text-slate-900 mb-4">So läuft es ab</h2>
          <p className="text-slate-500">In vier einfachen Schritten zu Ihrem fertigen Auftrag.</p>
        </div>
        <div className="grid md:grid-cols-4 gap-8">
          {STEPS.map((s) => (
            <div key={s.step} className="relative pt-6">
              <div className="text-7xl font-black text-slate-100 absolute -top-2 left-0 select-none">{s.step}</div>
              <div className="relative z-10 pt-10">
                <h3 className="font-bold text-lg text-slate-900 mb-2">{s.title}</h3>
                <p className="text-slate-500 text-sm">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Testimonials */}
      <section id="referenzen" className="bg-slate-50 border-y border-slate-200">
        <div className="max-w-6xl mx-auto px-6 py-20">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <h2 className="text-3xl md:text-4xl font-black text-slate-900 mb-4">Das sagen unsere Kunden</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {TESTIMONIALS.map((t) => (
              <div key={t.name} className="bg-white border border-slate-200 rounded-2xl p-6">
                <div className="flex gap-1 mb-3">
                  {Array.from({ length: t.stars }).map((_, i) => (
                    <Star key={i} size={16} className="fill-orange-400 text-orange-400" />
                  ))}
                </div>
                <p className="text-slate-600 mb-4 italic">&ldquo;{t.text}&rdquo;</p>
                <div className="font-bold text-slate-900">{t.name}</div>
                <div className="text-slate-500 text-sm">{t.role}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Quote form */}
      <section id="anfrage" className="max-w-6xl mx-auto px-6 py-20">
        <div className="grid md:grid-cols-2 gap-12 items-start">
          <div>
            <h2 className="text-3xl md:text-4xl font-black text-slate-900 mb-4">Kostenloses & unverbindliches Angebot</h2>
            <p className="text-slate-500 mb-8">
              Füllen Sie das Formular aus – wir melden uns innerhalb von 24 Stunden mit einem individuellen Festpreisangebot bei Ihnen.
            </p>
            <div className="space-y-4">
              <div className="flex items-center gap-3 text-slate-700">
                <Phone size={18} className="text-blue-900" /> 030 / 123 456 789
              </div>
              <div className="flex items-center gap-3 text-slate-700">
                <Mail size={18} className="text-blue-900" /> anfrage@rundumwerk24.de
              </div>
              <div className="flex items-center gap-3 text-slate-700">
                <Clock size={18} className="text-blue-900" /> Mo–Fr 08:00–18:00, Sa 09:00–13:00
              </div>
            </div>
          </div>
          <QuoteForm />
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="bg-slate-50 border-y border-slate-200">
        <div className="max-w-3xl mx-auto px-6 py-20">
          <h2 className="text-3xl md:text-4xl font-black text-slate-900 text-center mb-12">Häufige Fragen</h2>
          <div className="space-y-3">
            {FAQS.map((f) => (
              <FaqItem key={f.q} q={f.q} a={f.a} />
            ))}
          </div>
        </div>
      </section>

      {/* Contact / Footer */}
      <footer id="kontakt" className="bg-blue-950 text-blue-100">
        <div className="max-w-6xl mx-auto px-6 py-16 grid md:grid-cols-4 gap-10">
          <div>
            <div className="flex items-center gap-2 font-black text-xl text-white mb-4">
              <span className="bg-orange-500 text-white rounded-lg w-9 h-9 flex items-center justify-center">
                <HardHat size={18} />
              </span>
              RundumWerk24
            </div>
            <p className="text-sm text-blue-200">Ihr Rundum-Dienstleister für Umzüge, Transporte, Reinigung und Bau in ganz Deutschland.</p>
          </div>
          <div>
            <div className="font-bold text-white mb-4">Leistungen</div>
            <ul className="space-y-2 text-sm text-blue-200">
              <li>Umzüge</li>
              <li>Transporte</li>
              <li>Reinigung</li>
              <li>Bau & Renovierung</li>
            </ul>
          </div>
          <div>
            <div className="font-bold text-white mb-4">Unternehmen</div>
            <ul className="space-y-2 text-sm text-blue-200">
              <li><a href="#leistungen" className="hover:text-white">Leistungen</a></li>
              <li><a href="#referenzen" className="hover:text-white">Referenzen</a></li>
              <li><a href="#faq" className="hover:text-white">FAQ</a></li>
              <li><a href="#anfrage" className="hover:text-white">Angebot anfordern</a></li>
            </ul>
          </div>
          <div>
            <div className="font-bold text-white mb-4">Kontakt</div>
            <ul className="space-y-3 text-sm text-blue-200">
              <li className="flex items-center gap-2"><Phone size={14} /> 030 / 123 456 789</li>
              <li className="flex items-center gap-2"><Mail size={14} /> anfrage@rundumwerk24.de</li>
              <li className="flex items-center gap-2"><MapPin size={14} /> Musterstraße 1, 10115 Berlin</li>
            </ul>
          </div>
        </div>
        <div className="border-t border-white/10">
          <div className="max-w-6xl mx-auto px-6 py-6 flex flex-col sm:flex-row gap-3 justify-between items-center text-xs text-blue-300">
            <p>© {new Date().getFullYear()} RundumWerk24. Alle Rechte vorbehalten.</p>
            <div className="flex gap-4">
              <Link href="/impressum" className="hover:text-white">Impressum</Link>
              <Link href="/datenschutz" className="hover:text-white">Datenschutz</Link>
              <Link href="/agb" className="hover:text-white">AGB</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

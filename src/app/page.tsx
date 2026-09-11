'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  HardHat,
  Menu,
  X,
  CheckCircle,
  Users,
  FileText,
  Handshake,
  ShieldCheck,
  Wrench,
  Star,
  Bell,
  Zap,
} from 'lucide-react'
import { TIERS, TIER_ORDER } from '@/lib/tiers'
import { GEWERKE } from '@/lib/gewerke'

const USPS = [
  {
    icon: <Star size={22} />,
    title: 'Bewertungssystem',
    desc: 'Jeder Subunternehmer wird nach Auftragsabschluss bewertet – Sie sehen Sterne-Bewertungen schon vor der Kontaktfreischaltung. Mehr Transparenz als bei klassischen Vermittlungsportalen.',
  },
  {
    icon: <Bell size={22} />,
    title: 'Sofort-Benachrichtigungen',
    desc: 'Neues Angebot? Sie erfahren es per E-Mail in Echtzeit – kein Nachschauen im Portal nötig.',
  },
  {
    icon: <Zap size={22} />,
    title: 'Einfache Auftragsvergabe',
    desc: 'Ein Klick auf „Auftrag vergeben“ genügt – alle anderen Angebote werden automatisch geschlossen, der Subunternehmer wird informiert.',
  },
]

const STEPS_AUFTRAGGEBER = [
  { icon: <FileText size={22} />, title: 'Auftrag einstellen', desc: 'Beschreiben Sie Ihr Gewerk, Ort und Umfang – in wenigen Minuten online.' },
  { icon: <Users size={22} />, title: 'Angebote erhalten', desc: 'Geprüfte Subunternehmer aus Polen geben Angebote auf Ihren Auftrag ab.' },
  { icon: <Handshake size={22} />, title: 'Direkt beauftragen', desc: 'Kontaktdaten freischalten und die Zusammenarbeit direkt vereinbaren.' },
]

const STEPS_SUBUNTERNEHMER = [
  { icon: <Wrench size={22} />, title: 'Profil anlegen', desc: 'Gewerke, Region und Firmendaten hinterlegen – kostenlos.' },
  { icon: <FileText size={22} />, title: 'Aufträge durchsuchen', desc: 'Passende Bauaufträge deutscher Unternehmen nach Gewerk und Region filtern.' },
  { icon: <Handshake size={22} />, title: 'Angebot abgeben', desc: 'Direkt online ein Angebot einreichen und mit dem Auftraggeber in Kontakt treten.' },
]

function Header() {
  const [open, setOpen] = useState(false)
  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-slate-200">
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-black text-xl text-slate-900">
          <span className="bg-blue-900 text-white rounded-lg w-9 h-9 flex items-center justify-center">
            <HardHat size={18} />
          </span>
          BauPartner<span className="text-orange-500">24</span>
        </Link>

        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
          <a href="#vorteile" className="hover:text-blue-900 transition">Vorteile</a>
          <a href="#so-funktionierts" className="hover:text-blue-900 transition">Wie es funktioniert</a>
          <a href="#gewerke" className="hover:text-blue-900 transition">Gewerke</a>
          <a href="#preise" className="hover:text-blue-900 transition">Preise</a>
        </nav>

        <div className="hidden md:flex items-center gap-3">
          <Link href="/login" className="text-sm font-semibold text-slate-700 hover:text-blue-900">Anmelden</Link>
          <Link
            href="/registrieren"
            className="bg-orange-500 hover:bg-orange-400 text-white font-bold py-2.5 px-5 rounded-lg text-sm transition"
          >
            Kostenlos registrieren
          </Link>
        </div>

        <button
          className="md:hidden text-slate-700"
          onClick={() => setOpen(!open)}
          aria-label={open ? 'Menü schließen' : 'Menü öffnen'}
          aria-expanded={open}
          aria-controls="mobile-menu"
        >
          {open ? <X size={26} /> : <Menu size={26} />}
        </button>
      </div>

      {open && (
        <div id="mobile-menu" className="md:hidden border-t border-slate-200 px-6 py-4 flex flex-col gap-4 bg-white">
          <a href="#vorteile" onClick={() => setOpen(false)} className="text-slate-700 font-medium">Vorteile</a>
          <a href="#so-funktionierts" onClick={() => setOpen(false)} className="text-slate-700 font-medium">Wie es funktioniert</a>
          <a href="#gewerke" onClick={() => setOpen(false)} className="text-slate-700 font-medium">Gewerke</a>
          <a href="#preise" onClick={() => setOpen(false)} className="text-slate-700 font-medium">Preise</a>
          <Link href="/login" onClick={() => setOpen(false)} className="text-slate-700 font-semibold">Anmelden</Link>
          <Link href="/registrieren" onClick={() => setOpen(false)} className="bg-orange-500 text-white font-bold py-3 rounded-lg text-sm text-center">
            Kostenlos registrieren
          </Link>
        </div>
      )}
    </header>
  )
}

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white text-slate-800">
      <Header />

      {/* Hero */}
      <section className="bg-gradient-to-b from-blue-950 to-blue-900 text-white">
        <div className="max-w-6xl mx-auto px-6 py-20 md:py-28 text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-1 text-sm mb-6">
            <ShieldCheck size={14} /> Für deutsche Bauunternehmen & polnische Subunternehmer
          </div>
          <h1 className="text-4xl md:text-5xl font-black leading-tight mb-6 max-w-3xl mx-auto">
            Der Marktplatz für <span className="text-orange-400">Subunternehmer</span> im Baugewerbe
          </h1>
          <p className="text-lg text-blue-100 mb-10 max-w-2xl mx-auto">
            BauPartner24 verbindet deutsche Bauunternehmen mit qualifizierten Subunternehmern für Trockenbau,
            Elektro, Sanitär, Fassade, Rohbau und mehr. Auftrag einstellen, Angebote erhalten, direkt beauftragen.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/registrieren?rolle=auftraggeber"
              className="bg-orange-500 hover:bg-orange-400 text-white font-bold py-3.5 px-7 rounded-lg text-center transition"
            >
              Ich suche Subunternehmer
            </Link>
            <Link
              href="/registrieren?rolle=subunternehmer"
              className="border border-white/40 hover:border-white text-white font-bold py-3.5 px-7 rounded-lg text-center transition"
            >
              Ich bin Subunternehmer
            </Link>
          </div>
        </div>
      </section>

      {/* USPs */}
      <section id="vorteile" className="max-w-6xl mx-auto px-6 py-20">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <h2 className="text-3xl md:text-4xl font-black text-slate-900 mb-4">Was uns von anderen Portalen unterscheidet</h2>
          <p className="text-slate-500">Mehr Transparenz, weniger Aufwand – für Auftraggeber und Subunternehmer.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {USPS.map((u) => (
            <div key={u.title} className="border border-slate-200 rounded-2xl p-6 hover:border-blue-900/40 hover:shadow-md transition">
              <div className="text-orange-500 mb-4">{u.icon}</div>
              <h3 className="font-bold text-lg text-slate-900 mb-2">{u.title}</h3>
              <p className="text-slate-500 text-sm">{u.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="so-funktionierts" className="max-w-6xl mx-auto px-6 py-20">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <h2 className="text-3xl md:text-4xl font-black text-slate-900 mb-4">So funktioniert BauPartner24</h2>
          <p className="text-slate-500">Für Auftraggeber und Subunternehmer – jeweils in drei einfachen Schritten.</p>
        </div>

        <div className="grid md:grid-cols-2 gap-10">
          <div>
            <h3 className="font-bold text-lg text-blue-900 mb-6 text-center">Für Bauunternehmen (Auftraggeber)</h3>
            <div className="space-y-6">
              {STEPS_AUFTRAGGEBER.map((s, i) => (
                <div key={s.title} className="flex gap-4">
                  <div className="shrink-0 w-10 h-10 rounded-full bg-blue-50 text-blue-900 flex items-center justify-center font-bold">
                    {i + 1}
                  </div>
                  <div>
                    <div className="font-bold text-slate-900 mb-1 flex items-center gap-2">{s.icon} {s.title}</div>
                    <div className="text-sm text-slate-500">{s.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="font-bold text-lg text-orange-500 mb-6 text-center">Für Subunternehmer</h3>
            <div className="space-y-6">
              {STEPS_SUBUNTERNEHMER.map((s, i) => (
                <div key={s.title} className="flex gap-4">
                  <div className="shrink-0 w-10 h-10 rounded-full bg-orange-50 text-orange-500 flex items-center justify-center font-bold">
                    {i + 1}
                  </div>
                  <div>
                    <div className="font-bold text-slate-900 mb-1 flex items-center gap-2">{s.icon} {s.title}</div>
                    <div className="text-sm text-slate-500">{s.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Gewerke */}
      <section id="gewerke" className="bg-slate-50 border-y border-slate-200">
        <div className="max-w-6xl mx-auto px-6 py-20">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-3xl md:text-4xl font-black text-slate-900 mb-4">Verfügbare Gewerke</h2>
            <p className="text-slate-500">Von Rohbau bis Photovoltaik – finden Sie den passenden Subunternehmer.</p>
          </div>
          <div className="flex flex-wrap gap-3 justify-center max-w-3xl mx-auto">
            {GEWERKE.map((g) => (
              <span key={g} className="bg-white border border-slate-200 rounded-full px-4 py-2 text-sm font-medium text-slate-700">
                {g}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="preise" className="max-w-6xl mx-auto px-6 py-20">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <h2 className="text-3xl md:text-4xl font-black text-slate-900 mb-4">Preise für Auftraggeber</h2>
          <p className="text-slate-500">Monatlich kündbar. Für Subunternehmer ist die Registrierung dauerhaft kostenlos.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {TIER_ORDER.map((tierId) => {
            const tier = TIERS[tierId]
            const popular = tierId === 'pro'
            return (
              <div
                key={tier.id}
                className={`rounded-2xl p-8 border-2 relative ${popular ? 'border-blue-900 shadow-lg' : 'border-slate-200'}`}
              >
                {popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-900 text-white text-xs font-bold px-3 py-1 rounded-full">
                    BELIEBTESTE WAHL
                  </div>
                )}
                <div className="text-lg font-bold text-slate-900 mb-1">{tier.name}</div>
                <div className="text-4xl font-black text-slate-900 mb-1">€{tier.priceEuro}</div>
                <div className="text-slate-400 text-sm mb-6">/Monat</div>
                <ul className="space-y-3 mb-8">
                  {tier.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-slate-600">
                      <CheckCircle size={16} className="text-orange-500 shrink-0" /> {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/registrieren?rolle=auftraggeber"
                  className={`block text-center w-full py-3 rounded-xl font-bold transition-all ${
                    popular ? 'bg-blue-900 hover:bg-blue-800 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-900'
                  }`}
                >
                  Jetzt starten
                </Link>
              </div>
            )
          })}
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-blue-950 text-blue-100">
        <div className="max-w-6xl mx-auto px-6 py-12 flex flex-col sm:flex-row justify-between gap-6">
          <div className="flex items-center gap-2 font-black text-xl text-white">
            <span className="bg-orange-500 text-white rounded-lg w-9 h-9 flex items-center justify-center">
              <HardHat size={18} />
            </span>
            BauPartner24
          </div>
          <div className="flex gap-6 text-sm text-blue-200">
            <Link href="/impressum" className="hover:text-white">Impressum</Link>
            <Link href="/datenschutz" className="hover:text-white">Datenschutz</Link>
            <Link href="/agb" className="hover:text-white">AGB</Link>
          </div>
        </div>
        <div className="border-t border-white/10">
          <div className="max-w-6xl mx-auto px-6 py-6 text-center text-xs text-blue-300">
            © {new Date().getFullYear()} BauPartner24 – eine Marke der GGV BAU GmbH. Alle Rechte vorbehalten.
          </div>
        </div>
      </footer>
    </div>
  )
}

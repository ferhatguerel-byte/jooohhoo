'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  Menu,
  X,
  CheckCircle,
  ShieldCheck,
  Sparkles,
  FileText,
  Wrench,
} from 'lucide-react'
import { TIERS, TIER_ORDER } from '@/lib/tiers'
import { GEWERKE } from '@/lib/gewerke'

const STEPS = [
  {
    n: '01',
    title: 'Projekt beschreiben',
    desc: 'Beschreibe dein Vorhaben in normaler Sprache. Unsere KI erstellt daraus automatisch ein strukturiertes Leistungsverzeichnis.',
  },
  {
    n: '02',
    title: 'Passende Anbieter',
    desc: 'Geprüfte Handwerksbetriebe mit passendem Gewerk, Region und Kapazität erhalten deinen Auftrag.',
  },
  {
    n: '03',
    title: 'Angebote vergleichen',
    desc: 'Alle Angebote beziehen sich auf denselben Leistungsumfang – Position für Position direkt vergleichbar.',
  },
]

const COMPARE_ROWS = [
  { label: 'Geprüfte Anbieter', bc: true, boerse: 'teilweise', phone: '–' },
  { label: 'Angebote vergleichbar', bc: true, boerse: '–', phone: '–' },
  { label: 'KI-Leistungsverzeichnis', bc: true, boerse: '–', phone: '–' },
  { label: 'Festpreis-Kennzeichnung', bc: true, boerse: 'teilweise', phone: '–' },
  { label: 'Bewertungssystem', bc: true, boerse: 'teilweise', phone: '–' },
  { label: 'Nachunternehmer-Börse', bc: true, boerse: 'selten', phone: '–' },
]

const VORTEILE = [
  { icon: <ShieldCheck size={22} />, title: 'Verifizierte Profile', desc: 'Gewerbe, Haftpflicht, Qualifikationsnachweise und Bewertungen strukturiert dargestellt.' },
  { icon: <FileText size={22} />, title: 'Transparente Preise', desc: 'Leistungspositionen statt schwer vergleichbarer Gesamtpreise – inklusive Festpreis-Kennzeichnung.' },
  { icon: <Sparkles size={22} />, title: 'Alles an einem Ort', desc: 'Auftrag, Leistungsverzeichnis, Angebote, Nachrichten und Vergabe – zentral organisiert.' },
]

function Header() {
  const [open, setOpen] = useState(false)
  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-slate-200 h-[76px] flex items-center">
      <div className="w-full max-w-6xl mx-auto px-6 flex items-center justify-between">
        <Link href="/" className="font-black text-2xl tracking-tight text-[#17202a]">
          BAU<span className="text-accent">VERSUS</span>
        </Link>

        <nav className="hidden md:flex items-center gap-8 text-sm text-slate-600">
          <a href="#so-funktionierts" className="hover:text-[#17202a] transition">So funktioniert&apos;s</a>
          <a href="#vorteile" className="hover:text-[#17202a] transition">Vorteile</a>
          <a href="#unternehmen" className="hover:text-[#17202a] transition">Für Unternehmen</a>
        </nav>

        <div className="hidden md:flex items-center gap-3">
          <Link href="/login" className="border border-slate-200 rounded-lg px-4 py-2.5 text-sm font-bold text-slate-700 hover:border-slate-400 transition">
            Anmelden
          </Link>
          <Link href="/registrieren" className="bg-accent hover:bg-accent-hover text-white rounded-lg px-4 py-2.5 text-sm font-bold transition">
            Auftrag starten
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
        <div id="mobile-menu" className="md:hidden absolute top-[76px] left-0 right-0 border-t border-slate-200 px-6 py-4 flex flex-col gap-4 bg-white">
          <a href="#so-funktionierts" onClick={() => setOpen(false)} className="text-slate-700 font-medium">So funktioniert&apos;s</a>
          <a href="#vorteile" onClick={() => setOpen(false)} className="text-slate-700 font-medium">Vorteile</a>
          <a href="#unternehmen" onClick={() => setOpen(false)} className="text-slate-700 font-medium">Für Unternehmen</a>
          <Link href="/login" onClick={() => setOpen(false)} className="text-slate-700 font-semibold">Anmelden</Link>
          <Link href="/registrieren" onClick={() => setOpen(false)} className="bg-accent text-white font-bold py-3 rounded-lg text-sm text-center">
            Auftrag starten
          </Link>
        </div>
      )}
    </header>
  )
}

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white text-[#17202a]">
      <Header />

      {/* Hero */}
      <section className="bg-gradient-to-br from-slate-50 to-white py-16 md:py-24">
        <div className="max-w-6xl mx-auto px-6 grid md:grid-cols-[1.1fr_0.9fr] gap-14 items-center">
          <div>
            <div className="text-accent font-extrabold text-xs uppercase tracking-widest mb-4">
              Die neue Plattform für Bau &amp; Handwerk
            </div>
            <h1 className="text-4xl md:text-6xl font-black leading-[1.03] tracking-tight mb-6 max-w-xl">
              Gute Handwerker finden.{' '}
              <span className="text-accent">Faire Angebote vergleichen.</span>
            </h1>
            <p className="text-lg text-slate-500 leading-relaxed max-w-xl mb-8">
              BAUVERSUS bringt Auftraggeber und geprüfte Fachbetriebe zusammen – mit einem KI-Leistungsverzeichnis,
              transparenten Angeboten und einem Matching, das wirklich zu deinem Projekt passt.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link href="/registrieren?rolle=auftraggeber" className="bg-accent hover:bg-accent-hover text-white font-bold py-3.5 px-7 rounded-lg text-center transition">
                Kostenlos Auftrag erstellen →
              </Link>
              <a href="#so-funktionierts" className="border border-slate-300 hover:border-slate-400 text-[#17202a] font-bold py-3.5 px-7 rounded-lg text-center transition">
                Mehr erfahren
              </a>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xl shadow-slate-200/50">
            <h3 className="font-bold text-lg mb-4">Beispiel: Wohnung renovieren</h3>
            <div className="border border-slate-200 rounded-lg p-3.5 mb-3">
              <strong className="block text-sm text-[#17202a] mb-0.5">Projekt</strong>
              <span className="text-sm text-slate-500">120 m² Wohnung komplett renovieren</span>
            </div>
            <div className="border border-slate-200 rounded-lg p-3.5 mb-3">
              <strong className="block text-sm text-[#17202a] mb-0.5">Ort</strong>
              <span className="text-sm text-slate-500">Berlin · 120 m² · Start flexibel</span>
            </div>
            <div className="bg-[#f6faf7] rounded-lg p-4 mt-4">
              <div className="text-3xl font-black text-[#17202a] mb-1">96 % Match</div>
              <div className="text-sm text-slate-500">
                Passende geprüfte Fachbetriebe werden anhand von Qualifikation, Erfahrung, Entfernung, Kapazität und
                Preisniveau bewertet.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="so-funktionierts" className="max-w-6xl mx-auto px-6 py-20 text-center">
        <div className="text-accent font-extrabold text-xs uppercase tracking-widest mb-3">Einfacher Ablauf</div>
        <h2 className="text-3xl md:text-4xl font-black tracking-tight mb-3">Von der Idee bis zum passenden Betrieb.</h2>
        <p className="text-slate-500 max-w-xl mx-auto mb-14">
          Kein Durchtelefonieren. Keine unübersichtlichen Angebote. Ein strukturierter Prozess.
        </p>
        <div className="grid md:grid-cols-3 gap-6 text-left">
          {STEPS.map((s) => (
            <div key={s.n} className="border border-slate-200 rounded-2xl p-7">
              <div className="text-3xl font-black text-slate-200 mb-3">{s.n}</div>
              <h3 className="font-bold text-lg mb-2">{s.title}</h3>
              <p className="text-slate-500 text-sm leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Compare */}
      <section className="bg-[#17202a] text-white py-20">
        <div className="max-w-6xl mx-auto px-6 grid md:grid-cols-[0.8fr_1.2fr] gap-14 items-center">
          <div>
            <div className="text-accent font-extrabold text-xs uppercase tracking-widest mb-3">Unser Unterschied</div>
            <h2 className="text-3xl md:text-4xl font-black tracking-tight mb-4">
              Nicht möglichst viele Kontakte. Sondern die richtigen.
            </h2>
            <p className="text-slate-300 leading-relaxed">
              BAUVERSUS setzt auf Qualität, Transparenz und passende Anbieter statt auf eine möglichst große Liste
              von Handwerkern.
            </p>
          </div>
          <div className="bg-white text-[#17202a] rounded-2xl overflow-hidden">
            <div className="grid grid-cols-4 px-5 py-4 font-extrabold bg-slate-50 text-sm border-b border-slate-200">
              <div>Kriterium</div>
              <div>BAUVERSUS</div>
              <div>Klassische Börse</div>
              <div>Telefon/Google</div>
            </div>
            {COMPARE_ROWS.map((row) => (
              <div key={row.label} className="grid grid-cols-4 px-5 py-4 text-sm border-b border-slate-100 last:border-0">
                <div>{row.label}</div>
                <div className="font-extrabold text-green-700">✓</div>
                <div className="text-slate-500">{row.boerse}</div>
                <div className="text-slate-400">{row.phone}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Vorteile */}
      <section id="vorteile" className="max-w-6xl mx-auto px-6 py-20 text-center">
        <div className="text-accent font-extrabold text-xs uppercase tracking-widest mb-3">Für Auftraggeber</div>
        <h2 className="text-3xl md:text-4xl font-black tracking-tight mb-14">Mehr Kontrolle. Weniger Risiko.</h2>
        <div className="grid md:grid-cols-3 gap-6 text-left">
          {VORTEILE.map((v) => (
            <div key={v.title} className="border border-slate-200 rounded-2xl p-7 hover:border-[#17202a]/30 hover:shadow-md transition">
              <div className="text-accent mb-4">{v.icon}</div>
              <h3 className="font-bold text-lg mb-2">{v.title}</h3>
              <p className="text-slate-500 text-sm leading-relaxed">{v.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Für Unternehmen / Nachunternehmer-Börse */}
      <section id="unternehmen" className="max-w-6xl mx-auto px-6 pb-20">
        <div className="grid md:grid-cols-3 gap-6">
          <div className="md:col-span-2 border border-slate-200 rounded-2xl p-8 bg-slate-50">
            <div className="text-accent font-extrabold text-xs uppercase tracking-widest mb-3">Für Bauunternehmen</div>
            <h2 className="text-2xl md:text-3xl font-black tracking-tight mb-3">Nachunternehmer finden – professionell.</h2>
            <p className="text-slate-500 mb-6 max-w-lg">
              Leistungsverzeichnis hochladen, Anforderungen definieren und passende Fachfirmen bzw. Kolonnen für dein
              Projekt erreichen.
            </p>
            <Link href="/registrieren?rolle=auftraggeber" className="bg-accent hover:bg-accent-hover text-white font-bold py-3 px-6 rounded-lg inline-block transition">
              Nachunternehmer suchen →
            </Link>
          </div>
          <div className="border border-slate-200 rounded-2xl p-8 flex flex-col justify-center">
            <div className="flex items-center gap-2 mb-3">
              <Wrench size={20} className="text-accent" />
              <h3 className="font-bold text-lg">Alle Gewerke</h3>
            </div>
            <p className="text-slate-500 text-sm leading-relaxed">
              {GEWERKE.join(' · ')}
            </p>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="preise" className="bg-slate-50 border-y border-slate-200 py-20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <div className="text-accent font-extrabold text-xs uppercase tracking-widest mb-3">Für Auftraggeber</div>
            <h2 className="text-3xl md:text-4xl font-black tracking-tight mb-3">Preise</h2>
            <p className="text-slate-500">Monatlich kündbar. Für Handwerksbetriebe ist die Registrierung dauerhaft kostenlos.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {TIER_ORDER.map((tierId) => {
              const tier = TIERS[tierId]
              const popular = tierId === 'pro'
              return (
                <div key={tier.id} className={`bg-white rounded-2xl p-8 border-2 relative ${popular ? 'border-[#17202a] shadow-lg' : 'border-slate-200'}`}>
                  {popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#17202a] text-white text-xs font-bold px-3 py-1 rounded-full">
                      BELIEBTESTE WAHL
                    </div>
                  )}
                  <div className="text-lg font-bold mb-1">{tier.name}</div>
                  <div className="text-4xl font-black mb-1">€{tier.priceEuro}</div>
                  <div className="text-slate-400 text-sm mb-6">/Monat</div>
                  <ul className="space-y-3 mb-8">
                    {tier.features.map((f) => (
                      <li key={f} className="flex items-center gap-2 text-sm text-slate-600">
                        <CheckCircle size={16} className="text-accent shrink-0" /> {f}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href="/registrieren?rolle=auftraggeber"
                    className={`block text-center w-full py-3 rounded-xl font-bold transition ${
                      popular ? 'bg-[#17202a] hover:bg-brand-hover text-white' : 'bg-slate-100 hover:bg-slate-200 text-[#17202a]'
                    }`}
                  >
                    Jetzt starten
                  </Link>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-accent text-white py-20 text-center px-6">
        <h2 className="text-3xl md:text-4xl font-black tracking-tight mb-3">Dein Projekt. Die richtigen Fachleute.</h2>
        <p className="text-white/90 mb-6">Erstelle deinen ersten Auftrag kostenlos.</p>
        <Link href="/registrieren?rolle=auftraggeber" className="bg-white text-[#17202a] font-bold py-3.5 px-8 rounded-lg inline-block hover:bg-slate-100 transition">
          Jetzt Auftrag erstellen →
        </Link>
      </section>

      {/* Footer */}
      <footer className="px-6 py-8 flex flex-col sm:flex-row justify-between items-center gap-3 text-sm text-slate-500 max-w-6xl mx-auto">
        <div>© {new Date().getFullYear()} BAUVERSUS – eine Marke der GGV BAU GmbH.</div>
        <div className="flex gap-4">
          <Link href="/impressum" className="hover:text-[#17202a]">Impressum</Link>
          <Link href="/datenschutz" className="hover:text-[#17202a]">Datenschutz</Link>
          <Link href="/agb" className="hover:text-[#17202a]">AGB</Link>
        </div>
      </footer>
    </div>
  )
}

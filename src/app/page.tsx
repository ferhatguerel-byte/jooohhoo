import Link from 'next/link'
import {
  CheckCircle,
  ShieldCheck,
  Sparkles,
  FileText,
  Wrench,
} from 'lucide-react'
import { TIERS, TIER_ORDER } from '@/lib/tiers'
import { getActiveGewerkeSeo } from '@/lib/seo/gewerke-seo'
import { getActiveCities } from '@/lib/seo/cities'
import { getCurrentUser } from '@/lib/current-user'
import TrackedCtaLink from '@/components/seo/TrackedCtaLink'
import HomeHeader from './HomeHeader'

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
  { label: 'Abrechnung', bc: 'Festes Abo, unbegrenzt Aufträge', leads: 'Bezahlung pro einzelnem Kontakt' },
  { label: 'Kontakt exklusiv?', bc: 'Ja, kein Weiterverkauf', leads: 'Oft an mehrere Betriebe gleichzeitig verkauft' },
  { label: 'Angebote direkt vergleichbar', bc: 'Ja', leads: 'Nein' },
  { label: 'KI-Leistungsverzeichnis', bc: 'Ja', leads: 'Nein' },
  { label: 'Festpreis-Kennzeichnung', bc: 'Ja', leads: 'Nein' },
  { label: 'Geprüfte Betriebe', bc: 'Ja', leads: 'Teilweise' },
]

const VORTEILE = [
  { icon: <ShieldCheck size={22} />, title: 'Verifizierte Profile', desc: 'Gewerbe, Haftpflicht, Qualifikationsnachweise und Bewertungen strukturiert dargestellt.' },
  { icon: <FileText size={22} />, title: 'Transparente Preise', desc: 'Leistungspositionen statt schwer vergleichbarer Gesamtpreise – inklusive Festpreis-Kennzeichnung.' },
  { icon: <Sparkles size={22} />, title: 'Alles an einem Ort', desc: 'Auftrag, Leistungsverzeichnis, Angebote, Nachrichten und Vergabe – zentral organisiert.' },
]

export default async function HomePage() {
  const user = await getCurrentUser()
  const gewerke = getActiveGewerkeSeo()
  const cities = getActiveCities()

  return (
    <div className="min-h-screen bg-white text-[#17202a]">
      <HomeHeader loggedIn={!!user} />

      {/* Hero */}
      <section className="bg-gradient-to-br from-slate-50 to-white py-16 md:py-24">
        <div className="max-w-6xl mx-auto px-6 grid md:grid-cols-[1.1fr_0.9fr] gap-14 items-center">
          <div>
            <div className="text-accent font-extrabold text-xs uppercase tracking-widest mb-4">
              Die neue Plattform für Bau &amp; Handwerk
            </div>
            <h1 className="text-4xl md:text-6xl font-black leading-[1.03] tracking-tight mb-6 max-w-xl">
              Bauprojekte einfach vergeben.{' '}
              <span className="text-accent">Angebote wirklich vergleichen.</span>
            </h1>
            <p className="text-lg text-slate-500 leading-relaxed max-w-xl mb-8">
              BAUVERSUS bringt Auftraggeber und passende Fachbetriebe zusammen – mit strukturierten Projekten,
              intelligentem Matching und vergleichbaren Angeboten.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link href="/handwerker" className="bg-accent hover:bg-accent-hover text-white font-bold py-3.5 px-7 rounded-lg text-center transition">
                Handwerker finden →
              </Link>
              <Link href="/nachunternehmer" className="border border-slate-300 hover:border-slate-400 text-[#17202a] font-bold py-3.5 px-7 rounded-lg text-center transition">
                Nachunternehmer finden →
              </Link>
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
              <div className="font-black text-lg text-[#17202a] mb-1">Intelligentes Matching</div>
              <div className="text-sm text-slate-500">
                Passende geprüfte Fachbetriebe werden anhand von Qualifikation, Erfahrung, Entfernung, Kapazität und
                Preisniveau ermittelt.
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
            {/* Mobile: gestapelte Karten, kein Scrollen nötig */}
            <div className="sm:hidden divide-y divide-slate-100">
              {COMPARE_ROWS.map((row) => (
                <div key={row.label} className="px-4 py-3.5">
                  <div className="font-bold text-sm mb-2">{row.label}</div>
                  <div className="space-y-1 text-xs">
                    <div className="flex items-start gap-1.5">
                      <span className="font-bold text-green-700 shrink-0">BAUVERSUS:</span>
                      <span className="text-slate-700">{row.bc}</span>
                    </div>
                    <div className="flex items-start gap-1.5">
                      <span className="font-bold text-slate-400 shrink-0">Lead-Portale:</span>
                      <span className="text-slate-400">{row.leads}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {/* Ab Tablet: klassische Tabelle */}
            <div className="hidden sm:block">
              <div className="grid grid-cols-[1.1fr_1.2fr_1.2fr] px-5 py-4 font-extrabold bg-slate-50 text-sm border-b border-slate-200">
                <div>Kriterium</div>
                <div>BAUVERSUS</div>
                <div>Lead-Kauf-Portale</div>
              </div>
              {COMPARE_ROWS.map((row) => (
                <div key={row.label} className="grid grid-cols-[1.1fr_1.2fr_1.2fr] px-5 py-4 text-sm border-b border-slate-100 last:border-0 items-center">
                  <div className="font-semibold">{row.label}</div>
                  <div className="font-bold text-green-700">{row.bc}</div>
                  <div className="text-slate-500">{row.leads}</div>
                </div>
              ))}
            </div>
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
              <h3 className="font-bold text-lg">Gewerke</h3>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {gewerke.map((g) => (
                <Link
                  key={g.slug}
                  href={`/handwerker/${g.slug}`}
                  className="text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-full px-2.5 py-1 transition"
                >
                  {g.name}
                </Link>
              ))}
            </div>
            <Link href="/handwerker" className="text-sm font-semibold text-brand hover:underline mt-4 inline-block">
              Alle Gewerke ansehen →
            </Link>
          </div>
        </div>
      </section>

      {/* Städte / Baukosten / Branchenbuch / Ratgeber */}
      <section className="max-w-6xl mx-auto px-6 pb-20 grid md:grid-cols-2 gap-6">
        <div className="border border-slate-200 rounded-2xl p-8">
          <h3 className="font-bold text-lg mb-3">Handwerker in Ihrer Stadt</h3>
          <div className="flex flex-wrap gap-1.5 mb-4">
            {cities.map((c) => (
              <Link
                key={c.slug}
                href={`/branchenbuch/${c.slug}`}
                className="text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-full px-2.5 py-1 transition"
              >
                {c.name}
              </Link>
            ))}
          </div>
          <Link href="/branchenbuch" className="text-sm font-semibold text-brand hover:underline">
            Zum Branchenbuch →
          </Link>
        </div>
        <div className="border border-slate-200 rounded-2xl p-8">
          <h3 className="font-bold text-lg mb-3">Baukosten &amp; Ratgeber</h3>
          <p className="text-slate-500 text-sm mb-4">
            Orientierung zu typischen Bauleistungen und Sanierungsprojekten sowie Fachwissen rund um Bau und
            Handwerk.
          </p>
          <div className="flex flex-wrap gap-4">
            <Link href="/baukosten" className="text-sm font-semibold text-brand hover:underline">
              Baukosten →
            </Link>
            <Link href="/ratgeber" className="text-sm font-semibold text-brand hover:underline">
              Ratgeber →
            </Link>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="preise" className="bg-slate-50 border-y border-slate-200 py-20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <div className="text-accent font-extrabold text-xs uppercase tracking-widest mb-3">Für Handwerksbetriebe</div>
            <h2 className="text-3xl md:text-4xl font-black tracking-tight mb-3">Preise</h2>
            <p className="text-slate-500">Für Auftraggeber sind Auftragserstellung und Suche dauerhaft kostenlos. Unternehmer wählen zwischen zwei Abrechnungsmodellen – beide mit unbegrenztem Zugriff auf alle Aufträge.</p>
          </div>
          <div className="grid sm:grid-cols-2 gap-6 max-w-2xl mx-auto">
            {TIER_ORDER.map((tierId) => {
              const tier = TIERS[tierId]
              const popular = tierId === 'yearly'
              return (
                <div key={tier.id} className={`bg-white rounded-2xl p-8 border-2 relative ${popular ? 'border-[#17202a] shadow-lg' : 'border-slate-200'}`}>
                  {popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#17202a] text-white text-xs font-bold px-3 py-1 rounded-full">
                      GÜNSTIGSTER PREIS
                    </div>
                  )}
                  <div className="text-lg font-bold mb-1">{tier.name}</div>
                  <div className="text-4xl font-black mb-1">€{tier.priceEuroPerMonth}</div>
                  <div className="text-slate-400 text-sm mb-6">/Monat · {tier.billingNote}</div>
                  <ul className="space-y-3 mb-8">
                    {tier.features.map((f) => (
                      <li key={f} className="flex items-center gap-2 text-sm text-slate-600">
                        <CheckCircle size={16} className="text-accent shrink-0" /> {f}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href="/registrieren?rolle=subunternehmer"
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
        <TrackedCtaLink
          href="/registrieren?rolle=auftraggeber"
          source="homepage_bottom_cta"
          className="bg-white text-[#17202a] font-bold py-3.5 px-8 rounded-lg inline-block hover:bg-slate-100 transition"
        >
          Jetzt Auftrag erstellen →
        </TrackedCtaLink>
      </section>

      {/* Footer */}
      <footer className="px-6 py-8 flex flex-col sm:flex-row justify-between items-center gap-3 text-sm text-slate-500 max-w-6xl mx-auto">
        <div>© {new Date().getFullYear()} BAUVERSUS – eine Marke der GGV BAU GmbH.</div>
        <div className="flex gap-4 flex-wrap justify-center">
          <Link href="/handwerker" className="hover:text-[#17202a]">Handwerker</Link>
          <Link href="/nachunternehmer" className="hover:text-[#17202a]">Nachunternehmer</Link>
          <Link href="/baukosten" className="hover:text-[#17202a]">Baukosten</Link>
          <Link href="/branchenbuch" className="hover:text-[#17202a]">Branchenbuch</Link>
          <Link href="/ratgeber" className="hover:text-[#17202a]">Ratgeber</Link>
          <Link href="/impressum" className="hover:text-[#17202a]">Impressum</Link>
          <Link href="/datenschutz" className="hover:text-[#17202a]">Datenschutz</Link>
          <Link href="/agb" className="hover:text-[#17202a]">AGB</Link>
        </div>
      </footer>
    </div>
  )
}

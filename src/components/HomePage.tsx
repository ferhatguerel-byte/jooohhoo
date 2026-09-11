'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
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
  HardHat,
} from 'lucide-react'
import { content, type Locale } from '@/lib/content'

const PHONE_TEL = 'tel:+4915252968818'
const CONTACT_EMAIL = 'anfrage@rundumwerk24.de'
const ADDRESS = 'Mühlenstr. 8a, 14167 Berlin'

type FormStatus = 'idle' | 'loading' | 'success' | 'error'

function Header({ t }: { t: (typeof content)['de'] }) {
  const [open, setOpen] = useState(false)

  const scrollTo = (id: string) => {
    setOpen(false)
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
  }

  const links = [
    { id: 'leistungen', label: t.nav.leistungen },
    { id: 'ablauf', label: t.nav.ablauf },
    { id: 'referenzen', label: t.nav.referenzen },
    { id: 'faq', label: t.nav.faq },
    { id: 'kontakt', label: t.nav.kontakt },
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
          <a href={PHONE_TEL} className="flex items-center gap-2 text-sm font-semibold text-slate-700 hover:text-blue-900">
            <Phone size={16} /> {t.phoneDisplay}
          </a>
          <Link
            href={t.langSwitchHref}
            className="text-sm font-semibold text-slate-500 hover:text-blue-900 border border-slate-200 rounded-md px-2 py-1"
          >
            {t.langSwitchLabel}
          </Link>
          <button
            onClick={() => scrollTo('anfrage')}
            className="bg-orange-500 hover:bg-orange-400 text-white font-bold py-2.5 px-5 rounded-lg text-sm transition"
          >
            {t.ctaAnfrage}
          </button>
        </div>

        <div className="md:hidden flex items-center gap-3">
          <Link
            href={t.langSwitchHref}
            className="text-sm font-semibold text-slate-500 border border-slate-200 rounded-md px-2 py-1"
          >
            {t.langSwitchLabel}
          </Link>
          <button
            className="text-slate-700"
            onClick={() => setOpen(!open)}
            aria-label={open ? t.menuCloseLabel : t.menuOpenLabel}
            aria-expanded={open}
            aria-controls="mobile-menu"
          >
            {open ? <X size={26} /> : <Menu size={26} />}
          </button>
        </div>
      </div>

      {open && (
        <div id="mobile-menu" className="md:hidden border-t border-slate-200 px-6 py-4 flex flex-col gap-4 bg-white">
          {links.map((l) => (
            <button key={l.id} onClick={() => scrollTo(l.id)} className="text-left text-slate-700 font-medium">
              {l.label}
            </button>
          ))}
          <a href={PHONE_TEL} className="flex items-center gap-2 text-slate-700 font-semibold">
            <Phone size={16} /> {t.phoneDisplay}
          </a>
          <button
            onClick={() => scrollTo('anfrage')}
            className="bg-orange-500 text-white font-bold py-3 rounded-lg text-sm"
          >
            {t.ctaAnfrage}
          </button>
        </div>
      )}
    </header>
  )
}

function QuoteForm({ t }: { t: (typeof content)['de'] }) {
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
      if (!res.ok) throw new Error(json.error || 'Unknown error')
      setStatus('success')
      form.reset()
    } catch (err) {
      setStatus('error')
      setError(err instanceof Error ? err.message : 'Unknown error')
    }
  }

  if (status === 'success') {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center shadow-sm">
        <CheckCircle className="mx-auto text-green-600 mb-4" size={40} />
        <h3 className="text-xl font-bold text-slate-900 mb-2">{t.form.successTitle}</h3>
        <p className="text-slate-600">{t.form.successDesc}</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-2xl p-6 md:p-8 shadow-sm space-y-4">
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="qf-name" className="block text-sm font-semibold text-slate-700 mb-1">{t.form.name}</label>
          <input id="qf-name" name="name" required className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-900/30 focus:border-blue-900" />
        </div>
        <div>
          <label htmlFor="qf-telefon" className="block text-sm font-semibold text-slate-700 mb-1">{t.form.phone}</label>
          <input id="qf-telefon" name="telefon" type="tel" className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-900/30 focus:border-blue-900" />
        </div>
      </div>

      <div>
        <label htmlFor="qf-email" className="block text-sm font-semibold text-slate-700 mb-1">{t.form.email}</label>
        <input id="qf-email" name="email" type="email" required className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-900/30 focus:border-blue-900" />
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="qf-leistung" className="block text-sm font-semibold text-slate-700 mb-1">{t.form.service}</label>
          <select id="qf-leistung" name="leistung" required defaultValue="" className="w-full border border-slate-300 rounded-lg px-4 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-900/30 focus:border-blue-900">
            <option value="" disabled>{t.form.servicePlaceholder}</option>
            {t.form.serviceOptions.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="qf-termin" className="block text-sm font-semibold text-slate-700 mb-1">{t.form.date}</label>
          <input id="qf-termin" name="termin" type="date" min={new Date().toISOString().split('T')[0]} className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-900/30 focus:border-blue-900" />
        </div>
      </div>

      <div>
        <label htmlFor="qf-nachricht" className="block text-sm font-semibold text-slate-700 mb-1">{t.form.message}</label>
        <textarea id="qf-nachricht" name="nachricht" rows={4} placeholder={t.form.messagePlaceholder} className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-900/30 focus:border-blue-900" />
      </div>

      {status === 'error' && <p role="alert" className="text-sm text-red-600">{t.form.errorPrefix}{error}</p>}

      <button
        type="submit"
        disabled={status === 'loading'}
        className="w-full bg-blue-900 hover:bg-blue-800 disabled:opacity-50 text-white font-bold py-3.5 rounded-lg transition flex items-center justify-center gap-2"
      >
        {status === 'loading' ? t.form.submitLoading : t.form.submit} <ArrowRight size={18} />
      </button>
      <p className="text-xs text-slate-400 text-center">
        {t.form.privacyPre}{' '}
        <Link href="/datenschutz" className="underline hover:text-slate-600">{t.form.privacyLink}</Link> {t.form.privacyPost}
      </p>
    </form>
  )
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  const panelId = `faq-panel-${q.replace(/\W+/g, '-').toLowerCase()}`
  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls={panelId}
        className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left font-semibold text-slate-900"
      >
        {q}
        <ChevronDown size={20} className={`shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div id={panelId} className="px-5 pb-4 text-slate-600 text-sm leading-relaxed">{a}</div>}
    </div>
  )
}

export default function HomePage({ locale }: { locale: Locale }) {
  const t = content[locale]

  return (
    <div id="top" lang={t.htmlLang} className="min-h-screen bg-white text-slate-800">
      <Header t={t} />

      {/* Hero */}
      <section className="bg-gradient-to-b from-blue-950 to-blue-900 text-white">
        <div className="max-w-6xl mx-auto px-6 py-20 md:py-28 grid md:grid-cols-2 gap-12 items-center">
          <div>
            <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-1 text-sm mb-6">
              <ShieldCheck size={14} /> {t.hero.badge}
            </div>
            <h1 className="text-4xl md:text-5xl font-black leading-tight mb-6">
              {t.hero.titleLine1}{' '}
              <span className="text-orange-400">{t.hero.titleHighlight}</span>
            </h1>
            <p className="text-lg text-blue-100 mb-8 max-w-xl">{t.hero.subtitle}</p>
            <div className="flex flex-col sm:flex-row gap-4">
              <a
                href="#anfrage"
                className="bg-orange-500 hover:bg-orange-400 text-white font-bold py-3.5 px-7 rounded-lg text-center transition"
              >
                {t.hero.cta1}
              </a>
              <a
                href="#leistungen"
                className="border border-white/40 hover:border-white text-white font-bold py-3.5 px-7 rounded-lg text-center transition"
              >
                {t.hero.cta2}
              </a>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {t.services.map((s) => (
              <div key={s.title} className="bg-white/10 border border-white/15 rounded-2xl p-5 backdrop-blur">
                <div className="text-orange-400 mb-2">
                  <s.icon size={28} className={s.iconClassName} />
                </div>
                <div className="font-bold">{s.title}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-6 py-10 grid grid-cols-2 md:grid-cols-4 gap-6">
          {t.stats.map((s) => (
            <div key={s.label} className="text-center">
              <div className="text-blue-900 flex justify-center mb-2">
                <s.icon size={28} />
              </div>
              <div className="text-2xl font-black text-slate-900">{s.value}</div>
              <div className="text-slate-500 text-sm">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Services */}
      <section id="leistungen" className="max-w-6xl mx-auto px-6 py-20">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <h2 className="text-3xl md:text-4xl font-black text-slate-900 mb-4">{t.servicesSectionHeading}</h2>
          <p className="text-slate-500">{t.servicesSectionSubheading}</p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {t.services.map((s) => (
            <div key={s.title} className="border border-slate-200 rounded-2xl p-6 hover:border-blue-900/40 hover:shadow-md transition">
              <div className="text-blue-900 mb-4">
                <s.icon size={28} className={s.iconClassName} />
              </div>
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
            <h2 className="text-3xl md:text-4xl font-black text-slate-900 mb-4">{t.whyUs.heading}</h2>
            <p className="text-slate-500">{t.whyUs.subheading}</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {t.whyUs.items.map((w) => (
              <div key={w.title} className="flex gap-4 bg-white border border-slate-200 rounded-xl p-5">
                <div className="text-blue-900 shrink-0 bg-blue-50 rounded-lg w-11 h-11 flex items-center justify-center">
                  <w.icon size={22} />
                </div>
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
          <h2 className="text-3xl md:text-4xl font-black text-slate-900 mb-4">{t.process.heading}</h2>
          <p className="text-slate-500">{t.process.subheading}</p>
        </div>
        <div className="grid md:grid-cols-4 gap-8">
          {t.process.steps.map((s) => (
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
            <h2 className="text-3xl md:text-4xl font-black text-slate-900 mb-4">{t.testimonials.heading}</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {t.testimonials.items.map((item) => (
              <div key={item.name} className="bg-white border border-slate-200 rounded-2xl p-6">
                <div className="flex gap-1 mb-3">
                  {Array.from({ length: item.stars }).map((_, i) => (
                    <Star key={i} size={16} className="fill-orange-400 text-orange-400" />
                  ))}
                </div>
                <p className="text-slate-600 mb-4 italic">&ldquo;{item.text}&rdquo;</p>
                <div className="font-bold text-slate-900">{item.name}</div>
                <div className="text-slate-500 text-sm">{item.role}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Quote form */}
      <section id="anfrage" className="max-w-6xl mx-auto px-6 py-20">
        <div className="grid md:grid-cols-2 gap-12 items-start">
          <div>
            <h2 className="text-3xl md:text-4xl font-black text-slate-900 mb-4">{t.quote.heading}</h2>
            <p className="text-slate-500 mb-8">{t.quote.desc}</p>
            <div className="space-y-4">
              <div className="flex items-center gap-3 text-slate-700">
                <Phone size={18} className="text-blue-900" /> {t.phoneDisplay}
              </div>
              <div className="flex items-center gap-3 text-slate-700">
                <Mail size={18} className="text-blue-900" /> {CONTACT_EMAIL}
              </div>
              <div className="flex items-center gap-3 text-slate-700">
                <Clock size={18} className="text-blue-900" /> {t.quote.hours}
              </div>
            </div>
          </div>
          <QuoteForm t={t} />
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="bg-slate-50 border-y border-slate-200">
        <div className="max-w-3xl mx-auto px-6 py-20">
          <h2 className="text-3xl md:text-4xl font-black text-slate-900 text-center mb-12">{t.faq.heading}</h2>
          <div className="space-y-3">
            {t.faq.items.map((f) => (
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
            <p className="text-sm text-blue-200">{t.footer.tagline}</p>
          </div>
          <div>
            <div className="font-bold text-white mb-4">{t.footer.servicesHeading}</div>
            <ul className="space-y-2 text-sm text-blue-200">
              {t.services.map((s) => (
                <li key={s.title}>{s.title}</li>
              ))}
            </ul>
          </div>
          <div>
            <div className="font-bold text-white mb-4">{t.footer.companyHeading}</div>
            <ul className="space-y-2 text-sm text-blue-200">
              {t.footer.companyLinks.map((l) => (
                <li key={l.href}><a href={l.href} className="hover:text-white">{l.label}</a></li>
              ))}
            </ul>
          </div>
          <div>
            <div className="font-bold text-white mb-4">{t.footer.contactHeading}</div>
            <ul className="space-y-3 text-sm text-blue-200">
              <li className="flex items-center gap-2"><Phone size={14} /> {t.phoneDisplay}</li>
              <li className="flex items-center gap-2"><Mail size={14} /> {CONTACT_EMAIL}</li>
              <li className="flex items-center gap-2"><MapPin size={14} /> {ADDRESS}</li>
            </ul>
          </div>
        </div>
        <div className="border-t border-white/10">
          <div className="max-w-6xl mx-auto px-6 py-6 flex flex-col sm:flex-row gap-3 justify-between items-center text-xs text-blue-300">
            <p>© {new Date().getFullYear()} RundumWerk24. {t.footer.copyright}</p>
            <div className="flex gap-4">
              <Link href="/impressum" className="hover:text-white">{t.footer.legal.impressum}</Link>
              <Link href="/datenschutz" className="hover:text-white">{t.footer.legal.datenschutz}</Link>
              <Link href="/agb" className="hover:text-white">{t.footer.legal.agb}</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

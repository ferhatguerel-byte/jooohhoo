'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Menu, X } from 'lucide-react'
import BackButton from '@/components/layout/BackButton'
import { getPublicFallbackHref } from '@/lib/navigation'
import { usePathname } from 'next/navigation'

export default function HomeHeader({ loggedIn, showBackButton = true }: { loggedIn: boolean; showBackButton?: boolean }) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-slate-200 h-[76px] flex items-center">
      <div className="w-full max-w-6xl mx-auto px-6 flex items-center justify-between">
        <div className="flex items-center gap-4 min-w-0">
          {showBackButton && <BackButton fallbackHref={getPublicFallbackHref(pathname)} hiddenOn={['/']} />}
          <Link href={loggedIn ? '/dashboard' : '/'} className="font-black text-2xl tracking-tight text-[#17202a]">
            BAU<span className="text-accent">VERSUS</span>
          </Link>
        </div>

        {/* "So funktioniert's"/"Vorteile"/"Für Unternehmen" verweisen auf Abschnitte, die
            ausschließlich auf der Startseite existieren (src/app/page.tsx) – dieser Header wird
            aber auf allen öffentlichen Seiten wiederverwendet. Ein bloßes href="#..." würde auf
            jeder anderen Seite ins Leere laufen (kein Element mit dieser ID im DOM). Mit
            href="/#..." navigiert Next.js bei Bedarf clientseitig zur Startseite und scrollt dort
            automatisch zum passenden Abschnitt; ist man bereits auf "/", scrollt derselbe Link
            ohne Reload direkt zum Abschnitt (natives Anchor-Verhalten). */}
        <nav className="hidden md:flex items-center gap-8 text-sm text-slate-600">
          <Link href="/#so-funktionierts" className="hover:text-[#17202a] transition">So funktioniert&apos;s</Link>
          <Link href="/#vorteile" className="hover:text-[#17202a] transition">Vorteile</Link>
          <Link href="/#unternehmen" className="hover:text-[#17202a] transition">Für Unternehmen</Link>
          <Link href="/branchenbuch" className="hover:text-[#17202a] transition">Branchenbuch</Link>
          <Link href="/ratgeber" className="hover:text-[#17202a] transition">Ratgeber</Link>
        </nav>

        <div className="hidden md:flex items-center gap-3">
          {loggedIn ? (
            <Link href="/dashboard" className="bg-accent hover:bg-accent-hover text-white rounded-lg px-4 py-2.5 text-sm font-bold transition">
              Zum Dashboard →
            </Link>
          ) : (
            <>
              <Link href="/login" className="border border-slate-200 rounded-lg px-4 py-2.5 text-sm font-bold text-slate-700 hover:border-slate-400 transition">
                Anmelden
              </Link>
              <Link href="/registrieren" className="bg-accent hover:bg-accent-hover text-white rounded-lg px-4 py-2.5 text-sm font-bold transition">
                Auftrag starten
              </Link>
            </>
          )}
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
          <Link href="/#so-funktionierts" onClick={() => setOpen(false)} className="text-slate-700 font-medium">So funktioniert&apos;s</Link>
          <Link href="/#vorteile" onClick={() => setOpen(false)} className="text-slate-700 font-medium">Vorteile</Link>
          <Link href="/#unternehmen" onClick={() => setOpen(false)} className="text-slate-700 font-medium">Für Unternehmen</Link>
          <Link href="/branchenbuch" onClick={() => setOpen(false)} className="text-slate-700 font-medium">Branchenbuch</Link>
          <Link href="/ratgeber" onClick={() => setOpen(false)} className="text-slate-700 font-medium">Ratgeber</Link>
          {loggedIn ? (
            <Link href="/dashboard" onClick={() => setOpen(false)} className="bg-accent text-white font-bold py-3 rounded-lg text-sm text-center">
              Zum Dashboard →
            </Link>
          ) : (
            <>
              <Link href="/login" onClick={() => setOpen(false)} className="text-slate-700 font-semibold">Anmelden</Link>
              <Link href="/registrieren" onClick={() => setOpen(false)} className="bg-accent text-white font-bold py-3 rounded-lg text-sm text-center">
                Auftrag starten
              </Link>
            </>
          )}
        </div>
      )}
    </header>
  )
}

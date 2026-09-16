'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Menu, X } from 'lucide-react'

export default function HomeHeader({ loggedIn }: { loggedIn: boolean }) {
  const [open, setOpen] = useState(false)
  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-slate-200 h-[76px] flex items-center">
      <div className="w-full max-w-6xl mx-auto px-6 flex items-center justify-between">
        <Link href={loggedIn ? '/dashboard' : '/'} className="font-black text-2xl tracking-tight text-[#17202a]">
          BAU<span className="text-accent">VERSUS</span>
        </Link>

        <nav className="hidden md:flex items-center gap-8 text-sm text-slate-600">
          <a href="#so-funktionierts" className="hover:text-[#17202a] transition">So funktioniert&apos;s</a>
          <a href="#vorteile" className="hover:text-[#17202a] transition">Vorteile</a>
          <a href="#unternehmen" className="hover:text-[#17202a] transition">Für Unternehmen</a>
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
          <a href="#so-funktionierts" onClick={() => setOpen(false)} className="text-slate-700 font-medium">So funktioniert&apos;s</a>
          <a href="#vorteile" onClick={() => setOpen(false)} className="text-slate-700 font-medium">Vorteile</a>
          <a href="#unternehmen" onClick={() => setOpen(false)} className="text-slate-700 font-medium">Für Unternehmen</a>
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

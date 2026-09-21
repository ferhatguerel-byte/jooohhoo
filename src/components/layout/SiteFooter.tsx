import Link from 'next/link'

/**
 * Phase 4.1 – zentraler Footer für alle öffentlichen (nicht-authentifizierten) Seiten. Vorher
 * existierte dieser Footer nur inline auf der Startseite (`src/app/page.tsx`), auf jeder anderen
 * öffentlichen Seite (Branchenbuch, Firma, Handwerker, Nachunternehmer, Leistungen, Baukosten,
 * Ratgeber, Login, Registrieren, Passwort-Reset, Impressum/Datenschutz/AGB selbst) fehlten die
 * Pflichtlinks zu Impressum/Datenschutz/AGB vollständig (Phase-4.0-Audit-Fund).
 *
 * Bewusst NICHT im Root-Layout (`src/app/layout.tsx`) eingebunden: `/dashboard/*` hat ein eigenes,
 * App-artiges Layout (`src/app/dashboard/layout.tsx`, eigener Header/Nav, kein Footer-Slot
 * vorgesehen) – ein zusätzlicher, andersfarbiger Marketing-Footer dort würde optisch/strukturell
 * nicht zum bestehenden Dashboard-Layout passen. Stattdessen wird dieser Footer gezielt auf jeder
 * öffentlichen Seite eingebunden (siehe deren jeweilige page.tsx/Komponente).
 *
 * "Kontakt" verlinkt auf die einzige tatsächlich vorhandene öffentliche Kontaktmöglichkeit
 * (mailto, dieselbe Adresse wie im Organization-JSON-LD in src/app/layout.tsx) – es gibt aktuell
 * keine eigene /kontakt-Seite im Repository, ein Link dorthin wäre daher eine tote URL.
 */
export default function SiteFooter() {
  return (
    <footer className="px-6 py-8 flex flex-col sm:flex-row justify-between items-center gap-3 text-sm text-slate-500 max-w-6xl mx-auto">
      <div>© {new Date().getFullYear()} BAUVERSUS – eine Marke der GGV BAU GmbH.</div>
      <div className="flex gap-4 flex-wrap justify-center">
        <Link href="/handwerker" className="hover:text-[#17202a]">Handwerker</Link>
        <Link href="/nachunternehmer" className="hover:text-[#17202a]">Nachunternehmer</Link>
        <Link href="/baukosten" className="hover:text-[#17202a]">Baukosten</Link>
        <Link href="/branchenbuch" className="hover:text-[#17202a]">Branchenbuch</Link>
        <Link href="/ratgeber" className="hover:text-[#17202a]">Ratgeber</Link>
        <a href="mailto:kontakt@bauversus.de" className="hover:text-[#17202a]">Kontakt</a>
        <Link href="/impressum" className="hover:text-[#17202a]">Impressum</Link>
        <Link href="/datenschutz" className="hover:text-[#17202a]">Datenschutz</Link>
        <Link href="/agb" className="hover:text-[#17202a]">AGB</Link>
        <Link href="/widerruf" className="hover:text-[#17202a]">Widerruf</Link>
      </div>
    </footer>
  )
}

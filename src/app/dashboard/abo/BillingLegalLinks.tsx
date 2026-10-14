import Link from 'next/link'

/**
 * Phase 2B (Aufgabe 4) – reine Linkliste zu den bestehenden, unveränderten Rechtstexten. Ändert
 * NICHTS an deren Inhalt (AGB/Datenschutz/Impressum/Widerruf bleiben exakt wie vor dieser Phase).
 * Grund: der Checkout-/Abo-Bereich liegt unter /dashboard, wo SiteFooter (siehe
 * src/components/layout/SiteFooter.tsx) bewusst nicht eingebunden ist (eigenes App-Layout ohne
 * Footer-Slot) – dadurch waren diese Links aus dem eingeloggten Abo-Bereich bisher nicht
 * erreichbar (siehe Phase 2A, Abschnitt 5). Diese Komponente schließt NUR diese
 * Erreichbarkeits-Lücke, unabhängig vom noch offenen Verbraucherstatus/Freigabepunkt.
 */
export default function BillingLegalLinks() {
  return (
    <nav aria-label="Rechtliche Informationen" className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400 mt-6">
      <Link href="/agb" target="_blank" className="hover:text-slate-600 hover:underline">
        AGB
      </Link>
      <Link href="/datenschutz" target="_blank" className="hover:text-slate-600 hover:underline">
        Datenschutz
      </Link>
      <Link href="/impressum" target="_blank" className="hover:text-slate-600 hover:underline">
        Impressum
      </Link>
      <Link href="/widerruf" target="_blank" className="hover:text-slate-600 hover:underline">
        Widerruf
      </Link>
    </nav>
  )
}

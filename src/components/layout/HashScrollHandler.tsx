'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

/**
 * Rein funktionale, unsichtbare Komponente – einmal in src/app/layout.tsx eingebunden (neben
 * NavigationHistoryTracker), deckt sie damit jede Seite ab. Next.js' eingebautes Scroll-zu-Hash-
 * Verhalten bei clientseitiger <Link>-Navigation (z.B. von /branchenbuch zu /#vorteile aus
 * HomeHeader.tsx) hat sich als nicht zuverlässig erwiesen, wenn das Ziel weiter unten auf einer
 * ANDEREN Route liegt als der Ausgangspunkt (per Playwright-Test verifiziert) – deshalb wird das
 * Scrollen hier explizit und deterministisch selbst übernommen, ohne zusätzliche Library.
 *
 * Läuft bei jedem Pfadwechsel (deckt die clientseitige Cross-Route-Navigation ab) UND lauscht
 * zusätzlich auf "hashchange" (deckt einen Hash-Wechsel OHNE Pfadwechsel ab, z.B. Browser-
 * Vor-/Zurück zwischen zwei Ankern derselben Seite). scroll-behavior:smooth (globals.css) sorgt
 * für sanftes Scrollen, scroll-mt-* an den Zielabschnitten (siehe src/app/page.tsx) verhindert,
 * dass der feste Header den Abschnittstitel verdeckt.
 */
export default function HashScrollHandler() {
  const pathname = usePathname()

  useEffect(() => {
    function scrollToHash() {
      const hash = window.location.hash
      if (!hash) return
      const id = decodeURIComponent(hash.slice(1))
      const target = document.getElementById(id)
      target?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }

    // Kurzes Timeout: nach einem Pfadwechsel muss der DOM des neuen Pfads sicher gerendert sein,
    // bevor das Ziel-Element gesucht/angesprungen wird.
    const timeoutId = window.setTimeout(scrollToHash, 0)
    window.addEventListener('hashchange', scrollToHash)
    return () => {
      window.clearTimeout(timeoutId)
      window.removeEventListener('hashchange', scrollToHash)
    }
  }, [pathname])

  return null
}

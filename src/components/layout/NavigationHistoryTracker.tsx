'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { recordNavigation } from '@/lib/navigation'

/**
 * Rein funktionale, unsichtbare Komponente – einmal in src/app/layout.tsx eingebunden, deckt sie
 * damit ALLE Seiten ab (öffentlich und Dashboard). Schreibt bei jedem Pfadwechsel in
 * sessionStorage, ob es in diesem Browser-Tab bereits eine vorherige, andere Seite gab (siehe
 * src/lib/navigation.ts für die Begründung). BackButton.tsx liest diesen Zustand, um zu
 * entscheiden, ob router.back() sinnvoll ist oder ein Fallback nötig ist.
 */
export default function NavigationHistoryTracker() {
  const pathname = usePathname()

  useEffect(() => {
    try {
      recordNavigation(window.sessionStorage, pathname)
    } catch {
      // sessionStorage kann fehlschlagen (z.B. privater Modus mit deaktiviertem Storage) – der
      // BackButton fällt in diesem Fall konservativ auf sein Fallback-Ziel zurück, niemals auf
      // ein kaputtes router.back().
    }
  }, [pathname])

  return null
}

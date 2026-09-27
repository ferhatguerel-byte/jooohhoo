'use client'

import { useRouter, usePathname } from 'next/navigation'
import { hasInAppNavigationHistory } from '@/lib/navigation'

interface BackButtonProps {
  /** Route, auf die zurückgeleitet wird, wenn kein sinnvoller Browser-Verlauf vorhanden ist. */
  fallbackHref: string
  /** Pfade, auf denen der Button nicht angezeigt wird (z.B. die Startseite des jeweiligen Bereichs). */
  hiddenOn: string[]
  className?: string
}

/**
 * Zentraler, wiederverwendbarer Zurück-Button (siehe HomeHeader.tsx für öffentliche Seiten und
 * dashboard/layout.tsx für den Dashboard-Bereich – EINE Implementierung statt Kopien pro Seite).
 *
 * router.back() statt einer festen Route: der Nutzer landet tatsächlich auf der zuvor besuchten
 * Seite, nicht pauschal auf der Startseite. hasInAppNavigationHistory() (src/lib/navigation.ts,
 * geschrieben von NavigationHistoryTracker.tsx) prüft dafür, ob in diesem Tab bereits ein anderer
 * Pfad geladen wurde – bei einem direkten Einstieg (neuer Tab, Lesezeichen, externer Link als
 * erste Seite) greift stattdessen fallbackHref.
 */
export default function BackButton({ fallbackHref, hiddenOn, className = '' }: BackButtonProps) {
  const router = useRouter()
  const pathname = usePathname()

  if (hiddenOn.includes(pathname)) return null

  function handleClick() {
    const canGoBack = typeof window !== 'undefined' && hasInAppNavigationHistory(window.sessionStorage)
    if (canGoBack) {
      router.back()
    } else {
      router.push(fallbackHref)
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label="Zurück zur vorherigen Seite"
      className={`flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-[#17202a] transition shrink-0 ${className}`}
    >
      ← Zurück
    </button>
  )
}

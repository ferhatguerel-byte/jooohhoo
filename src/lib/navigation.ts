/**
 * Zentrale, reine Navigations-Hilfsfunktionen für den globalen Zurück-Button
 * (src/components/layout/BackButton.tsx). Bewusst UI-frei/DOM-frei, damit sie ohne
 * Rendering-Infrastruktur (jsdom/RTL – hier nicht installiert) direkt in Vitest getestet
 * werden können.
 */

/**
 * Bestimmt das sinnvolle "übergeordnete" Fallback-Ziel für eine öffentliche Route, falls kein
 * nutzbarer Browser-Verlauf vorhanden ist (siehe shouldNavigateBack()). Eine Detailseite fällt auf
 * ihre Übersichtsseite zurück (z.B. /branchenbuch/elektriker/berlin -> /branchenbuch), eine
 * Übersichtsseite selbst und alle sonstigen Routen fallen auf die Startseite zurück.
 */
const PUBLIC_SECTIONS = ['/branchenbuch', '/handwerker', '/nachunternehmer', '/leistungen', '/baukosten', '/ratgeber']

export function getPublicFallbackHref(pathname: string): string {
  for (const section of PUBLIC_SECTIONS) {
    if (pathname.startsWith(`${section}/`)) return section
  }
  // /firma/[slug] wird ausschließlich vom Branchenbuch aus verlinkt, hat aber keine eigene
  // Übersichtsseite unter /firma.
  if (pathname.startsWith('/firma/')) return '/branchenbuch'
  return '/'
}

/**
 * Erkennung "gibt es einen sinnvollen vorherigen Eintrag in DIESEM Browser-Tab" für den globalen
 * Zurück-Button (BackButton.tsx). window.history.length ist dafür NICHT zuverlässig: reale
 * Browser (und Playwright) zählen bereits die anfängliche about:blank-Navigation eines frischen
 * Tabs mit, sodass history.length nach einem einzigen direkten Seitenaufruf bereits 2 statt 1
 * beträgt – router.back() würde dann fälschlich Richtung about:blank/aus der App heraus navigieren.
 *
 * Stattdessen wird über sessionStorage getrackt, ob in diesem Tab bereits ein ANDERER Pfad
 * geladen wurde, bevor der aktuelle erreicht wurde – sowohl bei clientseitiger Next.js-Navigation
 * als auch bei einem vollen Seiten-Reload (z.B. manuell geänderte URL), da sessionStorage über
 * volle Navigationen im selben Tab hinweg erhalten bleibt. NavigationHistoryTracker.tsx schreibt,
 * BackButton.tsx liest.
 */
export const NAV_COUNT_STORAGE_KEY = 'bauversus_nav_count'
export const LAST_PATHNAME_STORAGE_KEY = 'bauversus_last_pathname'

export interface MinimalStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

/**
 * Vermerkt einen Pfadwechsel, falls sich der Pfad seit dem zuletzt in der Storage vermerkten Pfad
 * tatsächlich geändert hat. Wird bei jedem usePathname()-Wechsel aufgerufen (siehe
 * NavigationHistoryTracker.tsx) – der erste Aufruf in einem frischen Tab erhöht den Zähler noch
 * nicht (kein vorheriger Pfad bekannt), erst der zweite tatsächlich abweichende Pfad tut das.
 */
export function recordNavigation(storage: MinimalStorage, pathname: string): void {
  const lastPathname = storage.getItem(LAST_PATHNAME_STORAGE_KEY)
  if (lastPathname !== null && lastPathname !== pathname) {
    const count = Number(storage.getItem(NAV_COUNT_STORAGE_KEY) || '0')
    storage.setItem(NAV_COUNT_STORAGE_KEY, String(count + 1))
  }
  storage.setItem(LAST_PATHNAME_STORAGE_KEY, pathname)
}

/** Liest, ob recordNavigation() in diesem Tab bereits mindestens einen Pfadwechsel vermerkt hat. */
export function hasInAppNavigationHistory(storage: MinimalStorage): boolean {
  return Number(storage.getItem(NAV_COUNT_STORAGE_KEY) || '0') > 0
}

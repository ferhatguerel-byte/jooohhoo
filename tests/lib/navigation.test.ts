import { describe, it, expect } from 'vitest'
import {
  getPublicFallbackHref,
  recordNavigation,
  hasInAppNavigationHistory,
  NAV_COUNT_STORAGE_KEY,
  LAST_PATHNAME_STORAGE_KEY,
  type MinimalStorage,
} from '@/lib/navigation'

/** Minimaler In-Memory-Ersatz für sessionStorage, damit die Logik ohne DOM/jsdom testbar ist. */
function createMemoryStorage(): MinimalStorage {
  const store = new Map<string, string>()
  return {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => {
      store.set(key, value)
    },
  }
}

describe('getPublicFallbackHref — Fallback-Ziel für den globalen Zurück-Button (öffentliche Seiten)', () => {
  it('Detailseite einer Sektion fällt auf deren Übersichtsseite zurück', () => {
    expect(getPublicFallbackHref('/branchenbuch/elektriker')).toBe('/branchenbuch')
    expect(getPublicFallbackHref('/branchenbuch/elektriker/berlin')).toBe('/branchenbuch')
    expect(getPublicFallbackHref('/handwerker/maler')).toBe('/handwerker')
    expect(getPublicFallbackHref('/nachunternehmer/trockenbau')).toBe('/nachunternehmer')
    expect(getPublicFallbackHref('/leistungen/badsanierung')).toBe('/leistungen')
    expect(getPublicFallbackHref('/baukosten/badsanierung')).toBe('/baukosten')
    expect(getPublicFallbackHref('/ratgeber/irgendein-artikel')).toBe('/ratgeber')
  })

  it('/firma/[slug] fällt auf /branchenbuch zurück (einzige Verlinkungsquelle, keine eigene Übersicht)', () => {
    expect(getPublicFallbackHref('/firma/mustermann-gmbh')).toBe('/branchenbuch')
  })

  it('die Übersichtsseite einer Sektion selbst fällt auf die Startseite zurück (kein Rückfall auf sich selbst)', () => {
    expect(getPublicFallbackHref('/branchenbuch')).toBe('/')
    expect(getPublicFallbackHref('/handwerker')).toBe('/')
    expect(getPublicFallbackHref('/ratgeber')).toBe('/')
  })

  it('sonstige/unbekannte Routen fallen auf die Startseite zurück', () => {
    expect(getPublicFallbackHref('/impressum')).toBe('/')
    expect(getPublicFallbackHref('/login')).toBe('/')
    expect(getPublicFallbackHref('/')).toBe('/')
  })
})

describe('recordNavigation / hasInAppNavigationHistory — Erkennung echter In-App-Navigation', () => {
  it('frischer Tab (noch nie ein Pfad vermerkt): erster Aufruf zählt NICHT als Navigation', () => {
    const storage = createMemoryStorage()
    recordNavigation(storage, '/branchenbuch')
    expect(hasInAppNavigationHistory(storage)).toBe(false)
    expect(storage.getItem(LAST_PATHNAME_STORAGE_KEY)).toBe('/branchenbuch')
  })

  it('zweiter, abweichender Pfad im selben Tab: zählt als Navigation', () => {
    const storage = createMemoryStorage()
    recordNavigation(storage, '/')
    recordNavigation(storage, '/branchenbuch')
    expect(hasInAppNavigationHistory(storage)).toBe(true)
    expect(storage.getItem(NAV_COUNT_STORAGE_KEY)).toBe('1')
  })

  it('erneuter Aufruf mit demselben Pfad (z.B. Re-Render ohne echten Wechsel) erhöht den Zähler nicht', () => {
    const storage = createMemoryStorage()
    recordNavigation(storage, '/branchenbuch')
    recordNavigation(storage, '/branchenbuch')
    recordNavigation(storage, '/branchenbuch')
    expect(hasInAppNavigationHistory(storage)).toBe(false)
  })

  it('überlebt einen vollen Seiten-Reload (z.B. manuelle URL-Eingabe) über dieselbe Storage hinweg', () => {
    const storage = createMemoryStorage()
    // Erster voller Ladevorgang dieses Tabs.
    recordNavigation(storage, '/branchenbuch')
    // Zweiter voller Ladevorgang (z.B. Nutzer tippt eine neue URL ein) – dieselbe sessionStorage
    // bleibt über den Reload hinweg erhalten, daher wird dies korrekt als Navigation erkannt.
    recordNavigation(storage, '/ratgeber')
    expect(hasInAppNavigationHistory(storage)).toBe(true)
  })

  it('mehrere Navigationen erhöhen den Zähler kumulativ', () => {
    const storage = createMemoryStorage()
    recordNavigation(storage, '/')
    recordNavigation(storage, '/branchenbuch')
    recordNavigation(storage, '/ratgeber')
    expect(storage.getItem(NAV_COUNT_STORAGE_KEY)).toBe('2')
  })
})

import { getActiveGewerkeSeo } from '@/lib/seo/gewerke-seo'
import { getActiveCities } from '@/lib/seo/cities'

/**
 * Die bewusst kuratierte Erstauswahl aus Phase-2 §22: "zunächst 10 Gewerke × 10 große Städte
 * und prüfen die Qualität. Erst danach skalieren." Jede Kombination wird individuell über das
 * Quality Gate geprüft (siehe src/lib/seo/status.ts) – die meisten werden auf einer frischen
 * Plattform mangels echter Anbieter zunächst korrekt NOINDEX bleiben. Diese Liste ist absichtlich
 * statisch und klein; eine Erweiterung erfordert eine bewusste Code-Änderung, keinen
 * automatischen Cronjob.
 */
export function getCuratedGewerkCityCombinations(): { gewerkSlug: string; citySlug: string }[] {
  const gewerke = getActiveGewerkeSeo()
  const cities = getActiveCities()
  const combos: { gewerkSlug: string; citySlug: string }[] = []
  for (const g of gewerke) {
    for (const c of cities) {
      combos.push({ gewerkSlug: g.slug, citySlug: c.slug })
    }
  }
  return combos
}

export function isCuratedCombination(gewerkSlug: string, citySlug: string): boolean {
  return getCuratedGewerkCityCombinations().some((c) => c.gewerkSlug === gewerkSlug && c.citySlug === citySlug)
}

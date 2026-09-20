/**
 * Konfigurierbarer SEO-Quality-Score (Phase-2 §9). Gewichtung summiert sich zu 100.
 *
 * WICHTIG: Der Score ist ein Signal, keine Garantie. Er kann höchstens eine Seite zur Prüfung
 * vorschlagen ("REVIEW" bzw. "INDEXABLE_CANDIDATE") – die tatsächliche Freischaltung als
 * INDEXABLE erfolgt ausschließlich über eine explizite Admin-Entscheidung
 * (siehe resolveEffectiveStatus / src/lib/seo/status.ts). Ein Score >= 85 setzt eine Seite
 * NIE automatisch auf INDEXABLE.
 */
export const QUALITY_WEIGHTS = {
  uniqueContent: 20,
  realProviderData: 20,
  localRelevance: 15,
  serviceRelevance: 15,
  internalLinks: 10,
  metadata: 5,
  structuredData: 5,
  userIntent: 10,
} as const

export type QualityCriterion = keyof typeof QUALITY_WEIGHTS

export interface QualityScoreInput {
  /** Gibt es einen redaktionell kuratierten, nicht rein aus einer Vorlage erzeugten Intro-Text? */
  hasCuratedIntro: boolean
  /** Enthält der (ggf. templatebasierte) Text echte, lokale Fakten (z.B. reale Anbieterzahl)? */
  hasLocalFactsInTemplate: boolean
  /** Anzahl echter, aktiver Anbieter, die zu Gewerk+Stadt passen. */
  realProviderCount: number
  /** Anzahl echter Bewertungen unter diesen Anbietern. */
  realReviewCount: number
  /** Ist die Stadt Teil des gepflegten Städte-Datenmodells (src/lib/seo/cities.ts)? */
  isRecognizedCity: boolean
  /** Ist das Gewerk/die Leistung Teil des gepflegten Datenmodells? */
  isRecognizedService: boolean
  /** Hat das Gewerk/die Leistung gepflegte verwandte Leistungen (relatedServices)? */
  hasRelatedServices: boolean
  /** Anzahl interner Links auf der Seite (verwandte Leistungen, Städte, Ratgeber, CTA). */
  internalLinksCount: number
  /** Sind title, description und canonical individuell gesetzt? */
  hasCompleteMetadata: boolean
  /** Ist mindestens ein zutreffendes JSON-LD-Schema vorhanden? */
  hasStructuredData: boolean
  /**
   * Gehört diese exakte Kombination zur bewusst kuratierten Erstauswahl
   * (Phase-2 §22: "zunächst 10 Gewerke × 10 Städte")? Verhindert, dass beliebig erratene
   * URL-Kombinationen automatisch hohe Scores erreichen können.
   */
  isCuratedCombination: boolean
}

export interface QualityScoreResult {
  score: number
  breakdown: Record<QualityCriterion, number>
}

function scaleStep(value: number, steps: { min: number; points: number }[]): number {
  let result = 0
  for (const step of steps) {
    if (value >= step.min) result = step.points
  }
  return result
}

export function computeQualityScore(input: QualityScoreInput): QualityScoreResult {
  const breakdown: Record<QualityCriterion, number> = {
    uniqueContent: input.hasCuratedIntro
      ? QUALITY_WEIGHTS.uniqueContent
      : input.hasLocalFactsInTemplate
      ? Math.round(QUALITY_WEIGHTS.uniqueContent * 0.6)
      : 0,

    realProviderData: Math.min(
      QUALITY_WEIGHTS.realProviderData,
      scaleStep(input.realProviderCount, [
        { min: 1, points: 8 },
        { min: 3, points: 14 },
        { min: 6, points: 20 },
      ])
    ),

    localRelevance: !input.isRecognizedCity
      ? 0
      : input.realProviderCount > 0
      ? QUALITY_WEIGHTS.localRelevance
      : Math.round(QUALITY_WEIGHTS.localRelevance * 0.5),

    serviceRelevance: !input.isRecognizedService
      ? 0
      : input.hasRelatedServices
      ? QUALITY_WEIGHTS.serviceRelevance
      : Math.round(QUALITY_WEIGHTS.serviceRelevance * 0.5),

    internalLinks: scaleStep(input.internalLinksCount, [
      { min: 1, points: 4 },
      { min: 3, points: 8 },
      { min: 6, points: QUALITY_WEIGHTS.internalLinks },
    ]),

    metadata: input.hasCompleteMetadata ? QUALITY_WEIGHTS.metadata : 0,

    structuredData: input.hasStructuredData ? QUALITY_WEIGHTS.structuredData : 0,

    userIntent: input.isCuratedCombination ? QUALITY_WEIGHTS.userIntent : 0,
  }

  const score = Object.values(breakdown).reduce((sum, v) => sum + v, 0)
  return { score, breakdown }
}

export type ScoreSuggestion = 'NOINDEX' | 'REVIEW' | 'INDEXABLE_CANDIDATE'

/** Reine Score-Schwellenwerte (Phase-2 §9). Liefert nur einen Vorschlag, keinen finalen Status. */
export function suggestStatusFromScore(score: number): ScoreSuggestion {
  if (score < 70) return 'NOINDEX'
  if (score < 85) return 'REVIEW'
  return 'INDEXABLE_CANDIDATE'
}

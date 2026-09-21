import { estimatePlzDistanceKm } from '@/lib/plz-geo'
import type { ResponseTimeStats } from '@/lib/response-time'
import {
  MATCH_SCORE_WEIGHTS,
  MATCH_DISTANCE_BANDS,
  MATCH_VERIFICATION_POINTS,
  MATCH_PROJECT_SIZE_POINTS,
  MATCH_EXPERIENCE_LEVELS,
  MATCH_RATING_CONFIDENCE_SAMPLE_SIZE,
  MATCH_RESPONSE_TIME_BANDS,
  type MatchScoreFactor,
} from '@/lib/matching/score-config'

/**
 * Phase 3.4 – Matching Engine: Match Score.
 *
 * Reine, deterministische Funktion (kein DB-Zugriff, kein Zufall): gleicher Input erzeugt immer
 * denselben Output. Der Score beantwortet ausschließlich "wie gut passen die bekannten Daten
 * dieses Unternehmens zu DIESEM Projekt" – kein allgemeines Ranking, keine Empfehlung, keine
 * Preisbewertung, keine öffentliche Bewertung (siehe Vorgabe).
 *
 * Voraussetzung: der Provider hat den Hard Filter (Phase 3.3, filterProviderForJob) bereits
 * bestanden. Diese Funktion prüft keine Ausschlusskriterien erneut.
 */

export interface MatchScoreJob {
  gewerk: string
  plz: string
  /** Ganze Euro, wie jobs.budget_min. */
  budgetMin: number | null
  /** Ganze Euro, wie jobs.budget_max. */
  budgetMax: number | null
  /**
   * Alle distinct Gewerke aus job_line_items, falls vorhanden. Leer/undefined → nur
   * jobs.gewerk (Hauptgewerk) für die Leistungspassung verwenden (Vorgabe §4).
   */
  lineItemGewerke?: string[]
}

export interface MatchScoreProvider {
  gewerke: string[]
  plz: string
  serviceRadiusKm: number | null
  minProjectSize: number | null
  maxProjectSize: number | null
  verificationStatus: 'unverified' | 'pending' | 'verified' | 'rejected'
}

export interface MatchScoreMetrics {
  avgRating: number | null
  reviewCount: number
  responseTime: ResponseTimeStats | null
  offersSubmittedCount: number
  wonJobsCount: number
}

export interface MatchScoreResult {
  /** 0–100, immer eine ganze Zahl, normalisiert auf die tatsächlich verfügbaren Faktoren. */
  score: number
  breakdown: Record<MatchScoreFactor, number>
  /** Menschenlesbare Gründe, warum einzelne Faktoren neutral (nicht bewertbar) waren. */
  missingData: string[]
}

interface FactorResult {
  /** null = keine ausreichenden Daten -> Faktor wird neutral behandelt (aus der Normalisierung entfernt). */
  points: number | null
  max: number
  missingReason?: string
}

function computeServiceFit(job: MatchScoreJob, provider: MatchScoreProvider): FactorResult {
  const max = MATCH_SCORE_WEIGHTS.serviceFit
  const relevantGewerke =
    job.lineItemGewerke && job.lineItemGewerke.length > 0 ? [...new Set(job.lineItemGewerke)] : [job.gewerk]
  const matchedCount = relevantGewerke.filter((g) => provider.gewerke.includes(g)).length
  const fraction = matchedCount / relevantGewerke.length
  // Immer berechenbar: der Hard Filter garantiert bereits, dass mindestens jobs.gewerk beim
  // Provider vorhanden ist, daher nie "missing" für diesen Faktor.
  return { points: Math.round(fraction * max), max }
}

function computeDistance(job: MatchScoreJob, provider: MatchScoreProvider): FactorResult {
  const max = MATCH_SCORE_WEIGHTS.distance
  const distanceKm = estimatePlzDistanceKm(provider.plz, job.plz)
  if (distanceKm == null) {
    return { points: null, max, missingReason: 'Entfernung konnte anhand der PLZ nicht ermittelt werden.' }
  }
  const band = MATCH_DISTANCE_BANDS.find((b) => distanceKm <= b.maxKm)
  return { points: band ? band.points : 0, max }
}

function computeVerification(provider: MatchScoreProvider): FactorResult {
  // verification_status ist NOT NULL mit Default 'unverified' -> nie "missing".
  return { points: MATCH_VERIFICATION_POINTS[provider.verificationStatus], max: MATCH_SCORE_WEIGHTS.verification }
}

function computeProjectSize(job: MatchScoreJob, provider: MatchScoreProvider): FactorResult {
  const max = MATCH_SCORE_WEIGHTS.projectSize
  const jobHasBudget = job.budgetMin != null || job.budgetMax != null
  const providerHasRange = provider.minProjectSize != null || provider.maxProjectSize != null
  if (!jobHasBudget || !providerHasRange) {
    return { points: null, max, missingReason: 'Keine Projektgrößen-Angabe von Job und/oder Unternehmen vorhanden.' }
  }

  const jobMin = job.budgetMin ?? -Infinity
  const jobMax = job.budgetMax ?? Infinity
  const providerMin = provider.minProjectSize ?? -Infinity
  const providerMax = provider.maxProjectSize ?? Infinity

  // Der Hard Filter hat bereits eine Überschneidung der Intervalle sichergestellt – hier wird
  // nur noch graduiert, ob das Job-Intervall vollständig im Provider-Intervall liegt (bessere
  // Passung) oder nur teilweise überlappt.
  const fullyContained = jobMin >= providerMin && jobMax <= providerMax
  return { points: fullyContained ? MATCH_PROJECT_SIZE_POINTS.fullyContained : MATCH_PROJECT_SIZE_POINTS.partialOverlap, max }
}

function computeExperience(metrics: MatchScoreMetrics): FactorResult {
  const max = MATCH_SCORE_WEIGHTS.experience
  const totalActivity = metrics.offersSubmittedCount + metrics.wonJobsCount * 2
  if (totalActivity === 0) {
    return {
      points: null,
      max,
      missingReason: 'Noch keine Plattformhistorie (keine abgegebenen Angebote, keine gewonnenen Aufträge).',
    }
  }
  let points = 0
  for (const level of MATCH_EXPERIENCE_LEVELS) {
    if (totalActivity >= level.minActivity) points = level.points
  }
  return { points, max }
}

function computeRating(metrics: MatchScoreMetrics): FactorResult {
  const max = MATCH_SCORE_WEIGHTS.rating
  if (metrics.reviewCount === 0 || metrics.avgRating == null) {
    return { points: null, max, missingReason: 'Keine Bewertungen vorhanden.' }
  }
  // Wenige Bewertungen sind statistisch unsicher: die Punktzahl wird proportional zur
  // Datenbasis (reviewCount / MATCH_RATING_CONFIDENCE_SAMPLE_SIZE) zwischen dem tatsächlichen
  // Bewertungswert und einem neutralen Mittelwert (max/2) interpoliert, statt bei z.B. nur 1
  // Bewertung sofort voll auf die Bewertung zu vertrauen.
  const confidence = Math.min(metrics.reviewCount / MATCH_RATING_CONFIDENCE_SAMPLE_SIZE, 1)
  const ratingBasedPoints = (metrics.avgRating / 5) * max
  const points = confidence * ratingBasedPoints + (1 - confidence) * (max / 2)
  return { points: Math.round(points), max }
}

function computeResponseTime(metrics: MatchScoreMetrics): FactorResult {
  const max = MATCH_SCORE_WEIGHTS.responseTime
  if (!metrics.responseTime) {
    // getResponseTimeStatsBatch() liefert bereits nur bei ausreichender Datenbasis ein Ergebnis
    // (siehe src/lib/response-time.ts, sampleSize >= 3) – kein zusätzlicher Schwellenwert nötig.
    return { points: null, max, missingReason: 'Keine ausreichenden Reaktionszeit-Daten vorhanden.' }
  }
  const band = MATCH_RESPONSE_TIME_BANDS.find((b) => metrics.responseTime!.avgHours <= b.maxHours)
  return { points: band ? band.points : 0, max }
}

/**
 * Berechnet den Match Score für eine bereits Hard-Filter-eligible Job×Provider-Kombination.
 *
 * Normalisierung (Vorgabe §12): jeder Faktor ohne ausreichende Daten wird komplett aus Zähler
 * UND Nenner entfernt (weder Punkte noch maximal mögliche Punkte zählen) – der Score bezieht
 * sich also immer auf 100% der tatsächlich bewertbaren Faktoren, nie auf einen künstlich
 * abgesenkten Gesamtwert. serviceFit und verification sind praktisch nie "missing", daher ist
 * der Nenner nie 0 (Sicherheitsfallback: score=0, falls doch alle Faktoren fehlen sollten).
 */
export function calculateProviderMatchScore(
  job: MatchScoreJob,
  provider: MatchScoreProvider,
  metrics: MatchScoreMetrics
): MatchScoreResult {
  const factorResults: Record<MatchScoreFactor, FactorResult> = {
    serviceFit: computeServiceFit(job, provider),
    distance: computeDistance(job, provider),
    verification: computeVerification(provider),
    projectSize: computeProjectSize(job, provider),
    experience: computeExperience(metrics),
    rating: computeRating(metrics),
    responseTime: computeResponseTime(metrics),
  }

  const breakdown = {} as Record<MatchScoreFactor, number>
  const missingData: string[] = []
  let achievedTotal = 0
  let maxAvailableTotal = 0

  for (const key of Object.keys(factorResults) as MatchScoreFactor[]) {
    const factor = factorResults[key]
    if (factor.points == null) {
      breakdown[key] = 0
      if (factor.missingReason) missingData.push(factor.missingReason)
      continue
    }
    breakdown[key] = factor.points
    achievedTotal += factor.points
    maxAvailableTotal += factor.max
  }

  const score = maxAvailableTotal > 0 ? Math.round((achievedTotal / maxAvailableTotal) * 100) : 0

  return { score: Math.min(100, Math.max(0, score)), breakdown, missingData }
}

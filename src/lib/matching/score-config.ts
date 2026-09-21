/**
 * Phase 3.4 – zentrale Konfiguration für den Match Score. Alle Gewichte/Stufen ausschließlich
 * hier definiert, nirgends sonst als Magic Number verwendet.
 *
 * Ausgangsgewichtung aus der Vorgabe wurde vor der Implementierung gegen die tatsächlich
 * verfügbaren Daten geprüft (siehe Phase-3.1-Audit) und UNVERÄNDERT übernommen:
 * - serviceFit (30) und distance (20) sind praktisch immer berechenbar (job_line_items/
 *   jobs.gewerk und users.gewerke sind Pflichtfelder, estimatePlzDistanceKm() liefert für die
 *   allermeisten PLZ-Paare ein Ergebnis) – daher die höchsten Gewichte, da sie die stabilste
 *   Datenbasis haben.
 * - verification (15) ist ebenfalls immer vorhanden (verification_status ist NOT NULL mit
 *   Default 'unverified', nie fehlend).
 * - projectSize (15) ist inhaltlich wichtig, aber häufig unvollständig (jobs.budget_min/max und
 *   users.min/max_project_size sind beide optional) – das Gewicht bleibt trotzdem hoch, weil der
 *   Faktor bei fehlenden Daten ohnehin neutral aus der Normalisierung herausfällt (siehe
 *   calculateProviderMatchScore) und daher kein Risiko besteht, dünne Daten überzugewichten.
 * - experience/rating/responseTime (10/5/5) sind die volatilsten und am seltensten vollständig
 *   vorhandenen Signale (neue Unternehmen haben keine Historie) – bewusst am niedrigsten
 *   gewichtet, damit ein fehlendes Signal bei Normalisierung nie überproportional ins Gewicht
 *   fällt.
 * Fazit: keine Änderung der vorgeschlagenen Gewichtung nötig.
 */
export const MATCH_SCORE_WEIGHTS = {
  serviceFit: 30,
  distance: 20,
  verification: 15,
  projectSize: 15,
  experience: 10,
  rating: 5,
  responseTime: 5,
} as const

export type MatchScoreFactor = keyof typeof MATCH_SCORE_WEIGHTS

export const MATCH_SCORE_MAX_TOTAL = Object.values(MATCH_SCORE_WEIGHTS).reduce((sum, w) => sum + w, 0)

/** Entfernungsstufen (km-Obergrenze inklusive), Punkte aus MATCH_SCORE_WEIGHTS.distance. */
export const MATCH_DISTANCE_BANDS: { maxKm: number; points: number }[] = [
  { maxKm: 10, points: 20 },
  { maxKm: 25, points: 16 },
  { maxKm: 50, points: 12 },
  { maxKm: 100, points: 6 },
  { maxKm: Infinity, points: 0 },
]

/** Verifizierungsstufen – verification_status ist immer gesetzt, daher nie "missing". */
export const MATCH_VERIFICATION_POINTS: Record<'verified' | 'pending' | 'unverified' | 'rejected', number> = {
  verified: 15,
  pending: 8,
  unverified: 0,
  rejected: 0,
}

/**
 * Projektgrößen-Passung: Der Hard Filter (Phase 3.3) hat bereits sichergestellt, dass sich die
 * Intervalle überschneiden – hier wird nur noch graduiert, WIE gut die Passung ist (Job-Intervall
 * vollständig innerhalb des Provider-Intervalls vs. nur teilweise Überschneidung).
 */
export const MATCH_PROJECT_SIZE_POINTS = {
  fullyContained: 15,
  partialOverlap: 8,
} as const

/**
 * Erfahrungsstufen. totalActivity = offersSubmittedCount + wonJobsCount * 2 (ein gewonnener
 * Auftrag zählt doppelt, da er ein stärkeres Signal ist als eine bloße Angebotsabgabe).
 * totalActivity === 0 bedeutet "keine Plattformhistorie" und wird als fehlende Daten behandelt
 * (siehe computeExperience in score.ts), nicht als 0 Punkte.
 */
export const MATCH_EXPERIENCE_LEVELS: { minActivity: number; points: number }[] = [
  { minActivity: 1, points: 4 },
  { minActivity: 3, points: 7 },
  { minActivity: 6, points: 10 },
]

/**
 * Mindestanzahl an Bewertungen für volles Vertrauen in den Bewertungsfaktor. Bei weniger
 * Bewertungen wird der Faktor Richtung Mittelwert gedämpft (siehe computeRating in score.ts),
 * nicht hart auf 0 gesetzt und nicht als voll vertrauenswürdig behandelt.
 */
export const MATCH_RATING_CONFIDENCE_SAMPLE_SIZE = 3

/** Reaktionszeit-Stufen (Stunden-Obergrenze inklusive), Punkte aus MATCH_SCORE_WEIGHTS.responseTime. */
export const MATCH_RESPONSE_TIME_BANDS: { maxHours: number; points: number }[] = [
  { maxHours: 1, points: 5 },
  { maxHours: 4, points: 4 },
  { maxHours: 24, points: 2 },
  { maxHours: Infinity, points: 0 },
]

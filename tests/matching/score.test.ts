import { describe, it, expect } from 'vitest'
import { calculateProviderMatchScore, type MatchScoreJob, type MatchScoreProvider, type MatchScoreMetrics } from '@/lib/matching/score'
import { MATCH_SCORE_WEIGHTS } from '@/lib/matching/score-config'

const baseJob: MatchScoreJob = {
  gewerk: 'Elektro',
  plz: '10115', // Berlin
  budgetMin: null,
  budgetMax: null,
}

const baseProvider: MatchScoreProvider = {
  gewerke: ['Elektro'],
  plz: '10115',
  serviceRadiusKm: null,
  minProjectSize: null,
  maxProjectSize: null,
  verificationStatus: 'unverified',
}

const noMetrics: MatchScoreMetrics = {
  avgRating: null,
  reviewCount: 0,
  responseTime: null,
  offersSubmittedCount: 0,
  wonJobsCount: 0,
}

const richMetrics: MatchScoreMetrics = {
  avgRating: 4.8,
  reviewCount: 10,
  responseTime: { avgHours: 0.5, sampleSize: 20, label: 'unter 1 Stunde' },
  offersSubmittedCount: 20,
  wonJobsCount: 10,
}

describe('calculateProviderMatchScore — Phase 3.4', () => {
  it('1. vollständige Daten → hoher Score, jeder Faktor bewertet, keine missingData', () => {
    const job: MatchScoreJob = { ...baseJob, budgetMin: 20000, budgetMax: 50000 }
    const provider: MatchScoreProvider = {
      ...baseProvider,
      serviceRadiusKm: 50,
      minProjectSize: 10000,
      maxProjectSize: 100000,
      verificationStatus: 'verified',
    }
    const result = calculateProviderMatchScore(job, provider, richMetrics)
    expect(result.missingData).toEqual([])
    expect(result.score).toBeGreaterThan(80)
    expect(Object.values(result.breakdown).every((v) => v >= 0)).toBe(true)
  })

  it('2. keine Bewertungen → rating neutral (nicht 0), missingData enthält Hinweis', () => {
    const result = calculateProviderMatchScore(baseJob, baseProvider, noMetrics)
    expect(result.breakdown.rating).toBe(0)
    expect(result.missingData).toContain('Keine Bewertungen vorhanden.')
    // Score darf nicht so berechnet werden, als hätte der Faktor 0/5 Punkte "verdient" –
    // er darf schlicht nicht im Nenner auftauchen.
  })

  it('3. keine Response-Time-Daten → responseTime neutral, missingData enthält Hinweis', () => {
    const result = calculateProviderMatchScore(baseJob, baseProvider, { ...noMetrics, responseTime: null })
    expect(result.breakdown.responseTime).toBe(0)
    expect(result.missingData).toContain('Keine ausreichenden Reaktionszeit-Daten vorhanden.')
  })

  it('4. keine Projektgröße (weder Job noch Provider) → projectSize neutral', () => {
    const result = calculateProviderMatchScore(baseJob, baseProvider, noMetrics)
    expect(result.breakdown.projectSize).toBe(0)
    expect(result.missingData).toContain('Keine Projektgrößen-Angabe von Job und/oder Unternehmen vorhanden.')
  })

  it('5. unbekannte Distanz (unbekannte PLZ-Zone) → distance neutral', () => {
    const job: MatchScoreJob = { ...baseJob, plz: '00000' }
    const result = calculateProviderMatchScore(job, baseProvider, noMetrics)
    expect(result.breakdown.distance).toBe(0)
    expect(result.missingData).toContain('Entfernung konnte anhand der PLZ nicht ermittelt werden.')
  })

  it('6. neues Unternehmen (keine Angebote, keine gewonnenen Aufträge) → experience neutral, kein Malus', () => {
    const result = calculateProviderMatchScore(baseJob, baseProvider, noMetrics)
    expect(result.breakdown.experience).toBe(0)
    expect(result.missingData).toContain(
      'Noch keine Plattformhistorie (keine abgegebenen Angebote, keine gewonnenen Aufträge).'
    )
  })

  it('7. hohe Erfahrung (viele Angebote + gewonnene Aufträge) → volle experience-Punkte, kein missingData-Eintrag', () => {
    const metrics: MatchScoreMetrics = { ...noMetrics, offersSubmittedCount: 10, wonJobsCount: 5 }
    const result = calculateProviderMatchScore(baseJob, baseProvider, metrics)
    expect(result.breakdown.experience).toBe(MATCH_SCORE_WEIGHTS.experience)
    expect(result.missingData.some((m) => m.includes('Plattformhistorie'))).toBe(false)
  })

  it('8. niedrige Erfahrung (nur 1 Angebot) → reduzierte, aber positive experience-Punkte', () => {
    const metrics: MatchScoreMetrics = { ...noMetrics, offersSubmittedCount: 1, wonJobsCount: 0 }
    const result = calculateProviderMatchScore(baseJob, baseProvider, metrics)
    expect(result.breakdown.experience).toBeGreaterThan(0)
    expect(result.breakdown.experience).toBeLessThan(MATCH_SCORE_WEIGHTS.experience)
  })

  it('9. hohe Bewertung mit ausreichender Datenbasis → hohe rating-Punkte', () => {
    const metrics: MatchScoreMetrics = { ...noMetrics, avgRating: 5, reviewCount: 10 }
    const result = calculateProviderMatchScore(baseJob, baseProvider, metrics)
    expect(result.breakdown.rating).toBe(MATCH_SCORE_WEIGHTS.rating)
  })

  it('10. niedrige Bewertung mit ausreichender Datenbasis → niedrige rating-Punkte', () => {
    const metrics: MatchScoreMetrics = { ...noMetrics, avgRating: 1, reviewCount: 10 }
    const result = calculateProviderMatchScore(baseJob, baseProvider, metrics)
    expect(result.breakdown.rating).toBeLessThan(MATCH_SCORE_WEIGHTS.rating)
  })

  it('10b. sehr wenige Bewertungen (1 von 5 Sternen) werden Richtung Mittelwert gedämpft statt voll übernommen', () => {
    const fewMetrics: MatchScoreMetrics = { ...noMetrics, avgRating: 1, reviewCount: 1 }
    const manyMetrics: MatchScoreMetrics = { ...noMetrics, avgRating: 1, reviewCount: 10 }
    const fewResult = calculateProviderMatchScore(baseJob, baseProvider, fewMetrics)
    const manyResult = calculateProviderMatchScore(baseJob, baseProvider, manyMetrics)
    // Bei geringer Datenbasis darf die schlechte Bewertung nicht genauso hart durchschlagen
    // wie bei einer statistisch abgesicherten schlechten Bewertung.
    expect(fewResult.breakdown.rating).toBeGreaterThan(manyResult.breakdown.rating)
  })

  it('11. mehrere Gewerke in job_line_items, Provider deckt alle ab → volle serviceFit-Punkte', () => {
    const job: MatchScoreJob = { ...baseJob, lineItemGewerke: ['Elektro', 'Trockenbau'] }
    const provider: MatchScoreProvider = { ...baseProvider, gewerke: ['Elektro', 'Trockenbau'] }
    const result = calculateProviderMatchScore(job, provider, noMetrics)
    expect(result.breakdown.serviceFit).toBe(MATCH_SCORE_WEIGHTS.serviceFit)
  })

  it('12. teilweise passende Gewerke (Beispiel aus der Vorgabe: Trockenbau/Maler/Boden vs. Trockenbau/Maler) → hohe, aber nicht volle Punktzahl', () => {
    const job: MatchScoreJob = { ...baseJob, gewerk: 'Trockenbau', lineItemGewerke: ['Trockenbau', 'Maler & Lackierer', 'Bodenleger'] }
    const provider: MatchScoreProvider = { ...baseProvider, gewerke: ['Trockenbau', 'Maler & Lackierer'] }
    const result = calculateProviderMatchScore(job, provider, noMetrics)
    expect(result.breakdown.serviceFit).toBeGreaterThan(0)
    expect(result.breakdown.serviceFit).toBeLessThan(MATCH_SCORE_WEIGHTS.serviceFit)
  })

  it('13. vollständige Leistungspassung ohne job_line_items (nur Hauptgewerk) → volle serviceFit-Punkte', () => {
    const result = calculateProviderMatchScore(baseJob, baseProvider, noMetrics)
    expect(result.breakdown.serviceFit).toBe(MATCH_SCORE_WEIGHTS.serviceFit)
  })

  it('14. Projektgrößen-Passung: Job-Intervall vollständig im Provider-Intervall → volle Punktzahl', () => {
    const job: MatchScoreJob = { ...baseJob, budgetMin: 20000, budgetMax: 50000 }
    const provider: MatchScoreProvider = { ...baseProvider, minProjectSize: 10000, maxProjectSize: 100000 }
    const result = calculateProviderMatchScore(job, provider, noMetrics)
    expect(result.breakdown.projectSize).toBe(MATCH_SCORE_WEIGHTS.projectSize)
  })

  it('15. Projektgrößen-Passung: nur teilweise Überschneidung → reduzierte, aber positive Punktzahl', () => {
    const job: MatchScoreJob = { ...baseJob, budgetMin: 5000, budgetMax: 60000 }
    const provider: MatchScoreProvider = { ...baseProvider, minProjectSize: 50000, maxProjectSize: 100000 }
    const result = calculateProviderMatchScore(job, provider, noMetrics)
    expect(result.breakdown.projectSize).toBeGreaterThan(0)
    expect(result.breakdown.projectSize).toBeLessThan(MATCH_SCORE_WEIGHTS.projectSize)
  })

  it('16. fehlende Projektgröße beim Provider (Job hat Budget) → projectSize neutral', () => {
    const job: MatchScoreJob = { ...baseJob, budgetMin: 20000, budgetMax: 50000 }
    const result = calculateProviderMatchScore(job, baseProvider, noMetrics)
    expect(result.breakdown.projectSize).toBe(0)
    expect(result.missingData).toContain('Keine Projektgrößen-Angabe von Job und/oder Unternehmen vorhanden.')
  })

  it('17. deterministischer Score: gleicher Input → immer gleicher Output', () => {
    const job: MatchScoreJob = { ...baseJob, budgetMin: 20000, budgetMax: 50000 }
    const provider: MatchScoreProvider = { ...baseProvider, serviceRadiusKm: 50, minProjectSize: 10000, maxProjectSize: 100000 }
    const results = Array.from({ length: 5 }, () => calculateProviderMatchScore(job, provider, richMetrics))
    expect(new Set(results.map((r) => r.score)).size).toBe(1)
    expect(new Set(results.map((r) => JSON.stringify(r.breakdown))).size).toBe(1)
  })

  it('18. Score 0: alle bewertbaren Faktoren erzielen 0 Punkte', () => {
    const job: MatchScoreJob = { ...baseJob, gewerk: 'Elektro', lineItemGewerke: ['Sanitär & Heizung'], plz: '80331' }
    const provider: MatchScoreProvider = {
      ...baseProvider,
      gewerke: ['Elektro'], // Hard Filter bestünde noch (Hauptgewerk passt), aber Leistungspassung=0
      plz: '10115', // weit entfernt von job.plz (München) -> Distanzband 0 Punkte
      verificationStatus: 'unverified', // 0 Punkte
    }
    const result = calculateProviderMatchScore(job, provider, noMetrics)
    expect(result.score).toBe(0)
  })

  it('19. Score 100: alle bewertbaren Faktoren erzielen volle Punktzahl', () => {
    const job: MatchScoreJob = { ...baseJob, budgetMin: 20000, budgetMax: 50000 }
    const provider: MatchScoreProvider = {
      ...baseProvider,
      serviceRadiusKm: 1000,
      minProjectSize: 10000,
      maxProjectSize: 100000,
      verificationStatus: 'verified',
    }
    const metrics: MatchScoreMetrics = {
      avgRating: 5,
      reviewCount: 10,
      responseTime: { avgHours: 0.2, sampleSize: 10, label: 'unter 1 Stunde' },
      offersSubmittedCount: 10,
      wonJobsCount: 5,
    }
    const result = calculateProviderMatchScore(job, provider, metrics)
    expect(result.score).toBe(100)
    expect(result.missingData).toEqual([])
  })

  it('20. Breakdown-Summe stimmt mit dem normalisierten Score überein, wenn alle Faktoren bewertbar sind', () => {
    const job: MatchScoreJob = { ...baseJob, budgetMin: 20000, budgetMax: 50000 }
    const provider: MatchScoreProvider = {
      ...baseProvider,
      serviceRadiusKm: 1000,
      minProjectSize: 10000,
      maxProjectSize: 100000,
      verificationStatus: 'verified',
    }
    const result = calculateProviderMatchScore(job, provider, richMetrics)
    const sumOfPoints = Object.values(result.breakdown).reduce((a, b) => a + b, 0)
    const maxTotal = Object.values(MATCH_SCORE_WEIGHTS).reduce((a, b) => a + b, 0)
    expect(result.missingData).toEqual([])
    expect(result.score).toBe(Math.round((sumOfPoints / maxTotal) * 100))
  })

  it('21. Normalisierung bei fehlenden Daten: Score bezieht sich nur auf die tatsächlich bewertbaren Faktoren', () => {
    // Nur serviceFit (30) und verification (15) sind bewertbar, alles andere fehlt/neutral.
    const job: MatchScoreJob = { ...baseJob, plz: '00000' } // unbekannte Distanz, kein Budget
    const provider: MatchScoreProvider = { ...baseProvider, verificationStatus: 'verified' } // kein Radius, kein Projektgrößenbereich
    const result = calculateProviderMatchScore(job, provider, noMetrics)
    expect(result.missingData.length).toBeGreaterThan(0)
    // serviceFit voll (30) + verification voll (15) = 45 von 45 möglichen -> 100, NICHT 45 von 100.
    expect(result.score).toBe(100)
  })
})

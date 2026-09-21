import { isMeisterpflichtig } from '@/lib/gewerke'
import { estimatePlzDistanceKm } from '@/lib/plz-geo'

/**
 * Phase 3.3 – Matching Engine: Hard Filter.
 *
 * Reine, DB-freie Entscheidungsfunktion: "Kommt dieser Provider für diesen Job grundsätzlich
 * infrage?" Kein Score, kein Ranking – ein Provider ist entweder eligible oder ausgeschlossen
 * mit genau einem (dem ersten zutreffenden) Ausschlussgrund. Soft Matching/Score folgen erst
 * in einer späteren Phase (siehe Phase-3.1-Architekturbericht).
 *
 * Fehlende Daten sind grundsätzlich neutral (führen NICHT zum Ausschluss) – Ausnahme sind die
 * Felder, die bereits heute den bestehenden Marktplatz-Zugriff hart gaten (account_status,
 * subscription_status, Meisterpflicht-Verifizierung, Gewerke-Sperre): diese Prüfungen existieren
 * bereits produktiv in /api/jobs/[id]/offers und /dashboard/jobs und werden hier nur als reine
 * Funktion nachgebildet, nicht neu erfunden.
 */

export type ExclusionReason =
  | 'gewerk_mismatch'
  | 'blocked_gewerk'
  | 'missing_master_qualification'
  | 'account_inactive'
  | 'subscription_inactive'
  | 'out_of_radius'
  | 'project_size_mismatch'

export interface HardFilterJob {
  gewerk: string
  plz: string
  /** Ganze Euro, wie jobs.budget_min in der DB – keine Cent-Konvertierung. */
  budgetMin: number | null
  /** Ganze Euro, wie jobs.budget_max in der DB – keine Cent-Konvertierung. */
  budgetMax: number | null
}

export interface HardFilterProvider {
  gewerke: string[]
  blockedGewerke: string[]
  verifiedGewerke: string[]
  accountStatus: 'active' | 'suspended'
  subscriptionStatus: 'inactive' | 'active' | 'canceled' | 'past_due'
  plz: string
  /** null = keine Angabe. */
  serviceRadiusKm: number | null
  /** Ganze Euro, wie users.min_project_size in der DB – keine Cent-Konvertierung. null = keine Angabe. */
  minProjectSize: number | null
  /** Ganze Euro, wie users.max_project_size in der DB – keine Cent-Konvertierung. null = keine Angabe. */
  maxProjectSize: number | null
}

export interface HardFilterResult {
  eligible: boolean
  exclusionReason?: ExclusionReason
}

/**
 * Prüft, ob sich der Projektgrößen-Bereich des Jobs mit dem des Providers überschneidet.
 * Fehlende Angaben auf beiden Seiten sind neutral (kein Ausschluss) – nur wenn BEIDE Seiten
 * ausreichend Daten liefern, wird die Überschneidung geprüft. Ist nur eine Grenze (min ODER
 * max) auf einer Seite bekannt, wird auch nur diese eine Grenze geprüft.
 *
 * Beispiel (aus der Vorgabe):
 * Provider 10.000–100.000 € × Job 20.000–50.000 € → kompatibel (Job-Intervall liegt vollständig
 * innerhalb des Provider-Intervalls).
 * Provider 50.000–100.000 € × Job 10.000–30.000 € → inkompatibel (Intervalle überschneiden sich
 * nicht: das Jobmaximum 30.000 liegt unter dem Providerminimum 50.000).
 */
function projectSizeCompatible(job: HardFilterJob, provider: HardFilterProvider): boolean {
  const jobHasBudget = job.budgetMin != null || job.budgetMax != null
  const providerHasRange = provider.minProjectSize != null || provider.maxProjectSize != null
  if (!jobHasBudget || !providerHasRange) return true

  // Effektives Job-Intervall: fehlende Grenze wird durch die jeweils andere ersetzt, damit ein
  // Job mit nur einer angegebenen Grenze trotzdem sinnvoll gegen ein Provider-Intervall geprüft
  // werden kann (z.B. nur budgetMax gesetzt -> Job-Intervall ist [budgetMax, budgetMax]-untauglich,
  // stattdessen [-Infinity, budgetMax]).
  const jobMin = job.budgetMin ?? -Infinity
  const jobMax = job.budgetMax ?? Infinity
  const providerMin = provider.minProjectSize ?? -Infinity
  const providerMax = provider.maxProjectSize ?? Infinity

  // Zwei Intervalle sind kompatibel, wenn sie sich überschneiden (Standard-Intervall-Overlap).
  return jobMin <= providerMax && jobMax >= providerMin
}

/**
 * Reine Hard-Filter-Entscheidung für genau eine Job×Provider-Kombination. Keine DB-Zugriffe.
 * Prüfreihenfolge ist bewusst fest (siehe Dokumentation in getEligibleProvidersForJob) – bei
 * mehreren zutreffenden Ausschlussgründen wird immer der zuerst geprüfte zurückgegeben.
 */
export function filterProviderForJob(job: HardFilterJob, provider: HardFilterProvider): HardFilterResult {
  if (!provider.gewerke.includes(job.gewerk)) {
    return { eligible: false, exclusionReason: 'gewerk_mismatch' }
  }

  if (provider.blockedGewerke.includes(job.gewerk)) {
    return { eligible: false, exclusionReason: 'blocked_gewerk' }
  }

  if (isMeisterpflichtig(job.gewerk) && !provider.verifiedGewerke.includes(job.gewerk)) {
    return { eligible: false, exclusionReason: 'missing_master_qualification' }
  }

  if (provider.accountStatus !== 'active') {
    return { eligible: false, exclusionReason: 'account_inactive' }
  }

  if (provider.subscriptionStatus !== 'active') {
    return { eligible: false, exclusionReason: 'subscription_inactive' }
  }

  if (provider.serviceRadiusKm != null) {
    const distanceKm = estimatePlzDistanceKm(provider.plz, job.plz)
    // Unbekannte Distanz (z.B. unbekannte PLZ-Zone) ist neutral – nicht wegen fehlender
    // Geodaten ausschließen (Vorgabe §7).
    if (distanceKm != null && distanceKm > provider.serviceRadiusKm) {
      return { eligible: false, exclusionReason: 'out_of_radius' }
    }
  }

  if (!projectSizeCompatible(job, provider)) {
    return { eligible: false, exclusionReason: 'project_size_mismatch' }
  }

  return { eligible: true }
}

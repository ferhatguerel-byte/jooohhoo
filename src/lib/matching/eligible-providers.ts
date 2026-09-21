import { getDb } from '@/lib/db'
import { filterProviderForJob, type HardFilterJob, type HardFilterProvider, type HardFilterResult } from '@/lib/matching/hard-filter'

export interface ProviderMatchResult extends HardFilterResult {
  providerId: string
}

interface JobRow {
  gewerk: string
  plz: string
  budget_min: number | null
  budget_max: number | null
}

interface ProviderRow {
  id: string
  gewerke: string[]
  blocked_gewerke: string[]
  verified_gewerke: string[]
  account_status: 'active' | 'suspended'
  subscription_status: 'inactive' | 'active' | 'canceled' | 'past_due'
  plz: string
  service_radius_km: number | null
  min_project_size: number | null
  max_project_size: number | null
  verification_status: 'unverified' | 'pending' | 'verified' | 'rejected'
}

/**
 * Provider-Zeile, angereichert um verification_status – über HardFilterProvider hinaus, weil
 * der Hard Filter diesen Wert nicht braucht (Meisterpflicht läuft über verified_gewerke), der
 * Match Score (Phase 3.4) ihn aber für den Verifizierungs-Faktor benötigt. Bewusst NICHT Teil
 * von HardFilterProvider selbst, um dessen Interface (und die Phase-3.3-Tests) unverändert zu
 * lassen.
 */
export type CandidateProvider = HardFilterProvider & { id: string; verificationStatus: ProviderRow['verification_status'] }

export interface JobAndCandidates {
  job: HardFilterJob
  providers: CandidateProvider[]
}

/**
 * Lädt den Job und die grundsätzlich relevanten Kandidaten (Phase 3.3 §1/§2) aus der DB. Wird
 * sowohl von getEligibleProvidersForJob() (nur Hard Filter) als auch von der Match-Score-Pipeline
 * (Phase 3.4) verwendet – eine einzige Stelle für die Kandidaten-Query, keine doppelte SQL-Logik.
 *
 * Zwei getrennte Verantwortlichkeiten (Phase 3.3 §9/§10):
 * 1. SQL reduziert die Kandidatenmenge so weit wie ohne unnötige Komplexität möglich (Gewerk,
 *    Account-/Abo-Status – alles bereits als Index/einfache Bedingung vorhanden, siehe
 *    idx_users_role_subscription_status). Ein "SELECT alle users" und Filtern in JS für diese
 *    Kriterien würde bei wachsender Nutzerzahl unnötig viele Zeilen transportieren.
 * 2. Radius und Projektgröße werden bewusst NICHT in SQL geprüft (kein PostGIS, keine
 *    gespeicherten Koordinaten) – das würde die Query unnötig verkomplizieren, ohne einen
 *    echten Performance-Vorteil zu bringen (die eigentliche Reduktion passiert bereits durch
 *    Gewerk/Account/Abo). Diese beiden Kriterien laufen serverseitig über die bereits reine
 *    Funktion filterProviderForJob().
 *
 * Gewerke-Sperre und Meisterpflicht werden bewusst NICHT per SQL vorgefiltert, sondern in
 * filterProviderForJob() geprüft – so bleibt die komplette Ausschluss-Entscheidungslogik an
 * einer einzigen, testbaren Stelle statt auf SQL und JS verteilt.
 */
export async function fetchJobAndCandidateProviders(jobId: string): Promise<JobAndCandidates | null> {
  const db = getDb()

  const jobResult = await db.query<JobRow>(`SELECT gewerk, plz, budget_min, budget_max FROM jobs WHERE id = $1`, [jobId])
  const jobRow = jobResult.rows[0]
  if (!jobRow) return null

  const job: HardFilterJob = {
    gewerk: jobRow.gewerk,
    plz: jobRow.plz,
    budgetMin: jobRow.budget_min,
    budgetMax: jobRow.budget_max,
  }

  const candidatesResult = await db.query<ProviderRow>(
    `SELECT id, gewerke, blocked_gewerke, verified_gewerke, account_status, subscription_status,
            plz, service_radius_km, min_project_size, max_project_size, verification_status
     FROM users
     WHERE role = 'subunternehmer' AND account_status = 'active' AND subscription_status = 'active'
       AND $1 = ANY(gewerke)`,
    [job.gewerk]
  )

  const providers: CandidateProvider[] = candidatesResult.rows.map((row) => ({
    id: row.id,
    gewerke: row.gewerke || [],
    blockedGewerke: row.blocked_gewerke || [],
    verifiedGewerke: row.verified_gewerke || [],
    accountStatus: row.account_status,
    subscriptionStatus: row.subscription_status,
    plz: row.plz,
    serviceRadiusKm: row.service_radius_km,
    minProjectSize: row.min_project_size,
    maxProjectSize: row.max_project_size,
    verificationStatus: row.verification_status,
  }))

  return { job, providers }
}

/**
 * Interne Service-Funktion für "eligible providers for job" (Phase 3.3 §11). Reiner Hard-Filter-
 * Blick auf die Kandidaten – kein Score, siehe getScoredProvidersForJob() (Phase 3.4) dafür.
 */
export async function getEligibleProvidersForJob(jobId: string): Promise<ProviderMatchResult[]> {
  const data = await fetchJobAndCandidateProviders(jobId)
  if (!data) return []

  return data.providers.map((provider) => ({ providerId: provider.id, ...filterProviderForJob(data.job, provider) }))
}

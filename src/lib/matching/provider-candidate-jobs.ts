import { getDb } from '@/lib/db'
import type { HardFilterJob, HardFilterProvider } from '@/lib/matching/hard-filter'

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

interface JobRow {
  id: string
  gewerk: string
  plz: string
  budget_min: number | null
  budget_max: number | null
}

export type CandidateJob = HardFilterJob & { id: string }

/** Analog zu CandidateProvider aus eligible-providers.ts – siehe dort für die Begründung. */
export type CandidateProviderProfile = HardFilterProvider & { id: string; verificationStatus: ProviderRow['verification_status'] }

export interface ProviderAndCandidates {
  provider: CandidateProviderProfile
  jobs: CandidateJob[]
}

/**
 * Matching-Lifecycle – provider-zentriertes Gegenstück zu fetchJobAndCandidateProviders()
 * (eligible-providers.ts): lädt einen einzelnen Provider und alle für ihn relevanten offenen
 * Kandidaten-Jobs. Wird von getScoredJobsForProvider() (Pendant zu getScoredProvidersForJob())
 * verwendet.
 *
 * Kandidatenmenge (Invalidierungs-Strategie): UNION aus
 *   (a) aktuell zum Gewerke-Profil des Providers passenden offenen Jobs, und
 *   (b) offenen Jobs, für die bereits ein nicht-ausgeschlossener job_matches-Eintrag für diesen
 *       Provider existiert.
 * (b) ist notwendig, damit eine VERSCHLECHTERUNG des Profils (Gewerk entfernt, Radius verkleinert,
 * Projektgrößen-Bereich verengt, Verifizierung verloren) den bestehenden Match beim nächsten Lauf
 * tatsächlich neu bewertet und ggf. als excluded=true zurückschreibt – ohne (b) würde ein Job, der
 * nicht mehr zum aktuellen Gewerke-Profil passt, gar nicht mehr in die Berechnung einbezogen und
 * der veraltete Match bliebe fälschlich als excluded=false stehen (siehe
 * src/lib/matching/run-provider-matching.ts für die Persistierung).
 *
 * Geschlossene Jobs werden hier nie einbezogen (status='open'). Ein bestehender Match zu einem
 * inzwischen geschlossenen Job wird NICHT hier invalidiert, sondern ausschließlich lesend über den
 * status-Filter in /dashboard/passende-auftraege ausgeblendet – match_notifications/job_matches
 * bleiben als historische Datensätze unverändert.
 *
 * account_status/subscription_status des Providers werden hier bewusst NICHT vorgefiltert (anders
 * als bei fetchJobAndCandidateProviders): die Provider-Zeile wird immer geladen, filterProviderForJob()
 * entscheidet einheitlich über Eligibility – so bleibt eine einzige Hard-Filter-Entscheidungsstelle.
 */
export async function fetchProviderAndCandidateJobs(providerId: string): Promise<ProviderAndCandidates | null> {
  const db = getDb()

  const providerResult = await db.query<ProviderRow>(
    `SELECT id, gewerke, blocked_gewerke, verified_gewerke, account_status, subscription_status,
            plz, service_radius_km, min_project_size, max_project_size, verification_status
     FROM users WHERE id = $1 AND role = 'subunternehmer'`,
    [providerId]
  )
  const providerRow = providerResult.rows[0]
  if (!providerRow) return null

  const provider: CandidateProviderProfile = {
    id: providerRow.id,
    gewerke: providerRow.gewerke || [],
    blockedGewerke: providerRow.blocked_gewerke || [],
    verifiedGewerke: providerRow.verified_gewerke || [],
    accountStatus: providerRow.account_status,
    subscriptionStatus: providerRow.subscription_status,
    plz: providerRow.plz,
    serviceRadiusKm: providerRow.service_radius_km,
    minProjectSize: providerRow.min_project_size,
    maxProjectSize: providerRow.max_project_size,
    verificationStatus: providerRow.verification_status,
  }

  const jobsResult = await db.query<JobRow>(
    `SELECT id, gewerk, plz, budget_min, budget_max
     FROM jobs
     WHERE status = 'open'
       AND (
         gewerk = ANY($1::text[])
         OR id IN (SELECT job_id FROM job_matches WHERE provider_id = $2 AND excluded = false)
       )`,
    [provider.gewerke, providerId]
  )

  const jobs: CandidateJob[] = jobsResult.rows.map((row) => ({
    id: row.id,
    gewerk: row.gewerk,
    plz: row.plz,
    budgetMin: row.budget_min,
    budgetMax: row.budget_max,
  }))

  return { provider, jobs }
}

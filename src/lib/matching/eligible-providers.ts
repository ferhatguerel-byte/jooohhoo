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
}

/**
 * Interne Service-Funktion für "eligible providers for job" (Phase 3.3 §11). Noch keine
 * öffentliche API – wird von einer späteren Matching Engine (Phase 3.4+) konsumiert.
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
export async function getEligibleProvidersForJob(jobId: string): Promise<ProviderMatchResult[]> {
  const db = getDb()

  const jobResult = await db.query<JobRow>(`SELECT gewerk, plz, budget_min, budget_max FROM jobs WHERE id = $1`, [jobId])
  const jobRow = jobResult.rows[0]
  if (!jobRow) return []

  const job: HardFilterJob = {
    gewerk: jobRow.gewerk,
    plz: jobRow.plz,
    budgetMin: jobRow.budget_min,
    budgetMax: jobRow.budget_max,
  }

  // SQL-Vorfilter: nur grundsätzlich relevante Provider (Phase 3.3 §1) plus das Hauptgewerk
  // des Jobs (§2) – die schärfste, günstigste Einschränkung, da sie die Kandidatenmenge meist
  // auf einen Bruchteil aller Unternehmer reduziert, bevor überhaupt JS-Logik läuft.
  const candidatesResult = await db.query<ProviderRow>(
    `SELECT id, gewerke, blocked_gewerke, verified_gewerke, account_status, subscription_status,
            plz, service_radius_km, min_project_size, max_project_size
     FROM users
     WHERE role = 'subunternehmer' AND account_status = 'active' AND subscription_status = 'active'
       AND $1 = ANY(gewerke)`,
    [job.gewerk]
  )

  return candidatesResult.rows.map((row) => {
    const provider: HardFilterProvider = {
      gewerke: row.gewerke || [],
      blockedGewerke: row.blocked_gewerke || [],
      verifiedGewerke: row.verified_gewerke || [],
      accountStatus: row.account_status,
      subscriptionStatus: row.subscription_status,
      plz: row.plz,
      serviceRadiusKm: row.service_radius_km,
      minProjectSize: row.min_project_size,
      maxProjectSize: row.max_project_size,
    }
    return { providerId: row.id, ...filterProviderForJob(job, provider) }
  })
}

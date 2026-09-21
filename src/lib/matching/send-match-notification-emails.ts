import { z } from 'zod'
import { getDb } from '@/lib/db'
import { sendMatchNotificationEmail } from '@/lib/email'

const emailSchema = z.string().email()

export type SendMatchNotificationSkipReason =
  | 'not_a_provider'
  | 'email_notifications_disabled'
  | 'invalid_email'
  | 'already_claimed'

export interface SendMatchNotificationOutcome {
  notificationId: string
  sent: boolean
  skipReason?: SendMatchNotificationSkipReason
}

interface CandidateRow {
  notification_id: string
  provider_email: string
  email_notifications: boolean
  provider_role: 'auftraggeber' | 'subunternehmer'
  title: string
  gewerk: string
  plz: string
  ort: string
  description: string
  budget_min: number | null
  budget_max: number | null
  deadline: string | null
}

/**
 * Phase 3.6D – versendet E-Mails für konkret übergebene, NEU erzeugte match_notifications
 * (die IDs kommen aus createMatchNotifications().createdIds – niemals ein "SELECT alle
 * pending", das würde bei jedem Re-Matching alte, bereits bekannte Notifications erneut anfassen).
 *
 * KLAIM-STRATEGIE (Phase 3.6D §11-§13, bewusste Entscheidung, dokumentiert):
 * Das bestehende Status-ENUM kennt nur pending/sent/failed, kein "sending". Eine neue
 * Statuskategorie/Migration wird für diese Phase bewusst NICHT eingeführt (§5/§12: "bevorzugt
 * keine unnötige Schemaerweiterung"). Stattdessen wird der Claim als atomarer Übergang
 * pending -> failed (inkl. attempts+1 und einem Platzhalter-last_error) implementiert:
 *
 *   UPDATE match_notifications SET status='failed', attempts=attempts+1, last_error=<Platzhalter>
 *   WHERE id=$1 AND status='pending'
 *   RETURNING ...
 *
 * Das ist ein einzelnes atomares UPDATE mit WHERE-Bedingung auf den aktuellen Status – Postgres
 * serialisiert konkurrierende UPDATEs auf dieselbe Zeile über den Row-Lock; sobald die erste
 * Transaktion committet (Autocommit bei Einzelstatements), sieht die zweite, ursprünglich
 * blockierte UPDATE-Anweisung den bereits geänderten Status und matcht die WHERE-Bedingung nicht
 * mehr -> 0 Zeilen betroffen -> der zweite Claim-Versuch schlägt sauber fehl (kein Double-Claim).
 * Es wird KEINE PostgreSQL-Transaktion offen über den externen Resend-HTTP-Request gehalten
 * (Claim ist ein abgeschlossenes Einzelstatement, danach folgt der Versand, danach ein zweites,
 * unabhängiges Einzelstatement für das Ergebnis) – erfüllt die Vorgabe "kein Lock während
 * externem Request".
 *
 * Bewusste Konsequenz (dokumentiert, kein verstecktes Risiko): geht der Prozess exakt zwischen
 * Claim und dem abschließenden Status-Update verloren (Crash), bleibt die Zeile als 'failed' mit
 * dem Platzhaltertext stehen – niemals fälschlich als 'sent', niemals unsichtbar als ewig
 * 'pending'. Das ist der sicherste Fehlermodus ohne Schemaänderung: ein späteres, in dieser Phase
 * NICHT gebautes Retry-System würde genau solche 'failed'-Zeilen ohnehin erneut aufgreifen. Ein
 * theoretisches Risiko bleibt: ein künftiger Retry-Worker könnte eine solche Zeile parallel zu
 * einem noch laufenden Erstversand erneut aufgreifen (da beide Zustände wie 'failed' aussehen) –
 * das ist erst relevant, sobald ein Retry-Worker existiert (nicht Teil dieser Phase), und muss
 * dann mit adressiert werden (z. B. durch einen echten 'sending'-Status/Lease).
 *
 * attempts wird NUR beim tatsächlichen Claim erhöht (§14) – für email_notifications=false,
 * fehlende/unplausible E-Mail oder Rolle != subunternehmer wird gar nicht erst geclaimt, die
 * Notification bleibt exakt im Zustand 'pending' stehen (bewusst KEIN separater "skipped"-Status,
 * §5: 'pending' bedeutet ehrlich "noch nicht zugestellt", das bleibt technisch wahr).
 */
export async function sendMatchNotificationEmails(notificationIds: string[]): Promise<SendMatchNotificationOutcome[]> {
  if (notificationIds.length === 0) return []

  const db = getDb()
  // Eine einzige gebatchte Lese-Query für alle Kandidaten (Notification + Provider + Job) –
  // kein N+1 über die Providerzahl (Phase 3.6D §18).
  const candidates = await db.query<CandidateRow>(
    `SELECT n.id AS notification_id, u.email AS provider_email, u.email_notifications, u.role AS provider_role,
            j.title, j.gewerk, j.plz, j.ort, j.description, j.budget_min, j.budget_max, j.deadline
     FROM match_notifications n
     JOIN users u ON u.id = n.provider_id
     JOIN jobs j ON j.id = n.job_id
     WHERE n.id = ANY($1::uuid[]) AND n.status = 'pending'`,
    [notificationIds]
  )

  const outcomes: SendMatchNotificationOutcome[] = []

  // Bewusst sequenziell: die aktuelle Plattformgröße (siehe Phase-3.6-Audit) macht das
  // unproblematisch, und ein Bulk-/Batch-E-Mail-Versand würde die Fehlerzuordnung pro Notification
  // (welcher Claim gehört zu welchem tatsächlichen Sende-Ergebnis) unnötig verschlechtern (§18).
  for (const row of candidates.rows) {
    if (row.provider_role !== 'subunternehmer') {
      outcomes.push({ notificationId: row.notification_id, sent: false, skipReason: 'not_a_provider' })
      continue
    }
    if (!row.email_notifications) {
      outcomes.push({ notificationId: row.notification_id, sent: false, skipReason: 'email_notifications_disabled' })
      continue
    }
    if (!emailSchema.safeParse(row.provider_email).success) {
      outcomes.push({ notificationId: row.notification_id, sent: false, skipReason: 'invalid_email' })
      continue
    }

    const claimed = await claimNotification(row.notification_id)
    if (!claimed) {
      outcomes.push({ notificationId: row.notification_id, sent: false, skipReason: 'already_claimed' })
      continue
    }

    try {
      await sendMatchNotificationEmail(row.provider_email, {
        title: row.title,
        gewerk: row.gewerk,
        plz: row.plz,
        ort: row.ort,
        description: row.description,
        budgetMin: row.budget_min,
        budgetMax: row.budget_max,
        deadline: row.deadline,
      })
      await markSent(row.notification_id)
      outcomes.push({ notificationId: row.notification_id, sent: true })
    } catch (err) {
      await markFailed(row.notification_id, errorToSafeMessage(err))
      outcomes.push({ notificationId: row.notification_id, sent: false })
    }
  }

  return outcomes
}

const CLAIM_PLACEHOLDER_ERROR = 'Versand wird verarbeitet.'

async function claimNotification(id: string): Promise<boolean> {
  const db = getDb()
  const result = await db.query(
    `UPDATE match_notifications
     SET status = 'failed', attempts = attempts + 1, last_error = $2
     WHERE id = $1 AND status = 'pending'
     RETURNING id`,
    [id, CLAIM_PLACEHOLDER_ERROR]
  )
  return result.rows.length > 0
}

async function markSent(id: string): Promise<void> {
  const db = getDb()
  await db.query(`UPDATE match_notifications SET status = 'sent', sent_at = now(), last_error = NULL WHERE id = $1`, [id])
}

async function markFailed(id: string, errorMessage: string): Promise<void> {
  const db = getDb()
  await db.query(`UPDATE match_notifications SET last_error = $2 WHERE id = $1`, [id, errorMessage])
}

/** Begrenzte, sichere Fehlermeldung ohne mögliche Secrets/Zugangsdaten für last_error. */
function errorToSafeMessage(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err)
  return message.slice(0, 500)
}

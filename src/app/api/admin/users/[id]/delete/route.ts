import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { z } from 'zod'
import { del } from '@vercel/blob'
import { getDb } from '@/lib/db'
import { requireAdminApi } from '@/lib/authorization'
import { handleApiError } from '@/lib/api-error'
import { logAdminAction } from '@/lib/admin-audit'
import { hashPassword } from '@/lib/auth'
import { rateLimit } from '@/lib/security/rate-limit'
import { readJsonBody } from '@/lib/security/request-limits'
import { matchProviderAgainstOpenJobs } from '@/lib/matching/run-provider-matching'
import { captureError } from '@/lib/observability/sentry'

const schema = z.object({ confirmationName: z.string().min(1) })

/**
 * Admin-Unternehmensverwaltung – "Unternehmen löschen".
 *
 * KEINE physische DELETE-Operation auf users: jobs.awarded_subunternehmer_id hat keine
 * ON DELETE-Klausel (= RESTRICT, blockiert ein echtes DELETE sofort bei jedem Auftrag, den das
 * Unternehmen je gewonnen hat), und offers/reviews/offer_messages/admin_warnings/support_tickets
 * würden per ON DELETE CASCADE unwiederbringlich mitgerissen – das sind aber teils fremde Daten
 * (Bewertungen/Nachrichten der Gegenseite) bzw. rechtlich/vertraglich relevante Historie.
 * Stattdessen wird die Zeile anonymisiert (PII entfernt, company_name bleibt bewusst erhalten –
 * historische Angebote/Aufträge/Bewertungen bleiben für die jeweils andere Partei verständlich)
 * und über denselben zentralen account_status-Wert 'deleted' unsichtbar gemacht, den auch
 * publicProviderSqlCondition() (Phase A) bereits als "nicht öffentlich" behandelt.
 *
 * Stripe wird HIER NICHT angefasst: ein aktives/überfälliges Abo blockiert die Löschung (409) –
 * der Admin muss zuerst den bestehenden "Abo sofort kündigen"-Button (cancel-subscription/route.ts,
 * ruft bereits heute stripe.subscriptions.cancel() auf) verwenden.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: userId } = await params
  try {
    const admin = await requireAdminApi()
    const { confirmationName } = schema.parse(await readJsonBody(req))

    // Verteidigung in der Tiefe gegen einen kompromittierten Admin-Account oder einen
    // Retry-Bug – Admin-Routen haben sonst kein Rate-Limit (Admins gelten als vertrauenswürdig),
    // diese destruktive Aktion ist aber die eine bewusste Ausnahme.
    await rateLimit({ key: `admin-delete-provider:${admin.id}`, limit: 10, windowSeconds: 3600 })

    const db = getDb()
    const client = await db.connect()
    let companyName = ''
    let qualificationFilePathnames: string[] = []

    try {
      await client.query('BEGIN')

      // FOR UPDATE sperrt die Zeile für die Dauer der Transaktion: ein gleichzeitiger zweiter
      // Löschversuch (Doppelklick, zwei Admin-Tabs) oder ein zeitgleicher Webhook, der
      // subscription_status ändern würde, muss warten, bis diese Transaktion committed/
      // zurückgerollt hat – zwischen Prüfung und Schreiben kann daher kein Zwischenzustand
      // hereinkommen.
      const userResult = await client.query(
        `SELECT id, role, company_name, subscription_status, deleted_at
         FROM users WHERE id = $1 FOR UPDATE`,
        [userId]
      )
      const user = userResult.rows[0]

      if (!user) {
        await client.query('ROLLBACK')
        return NextResponse.json({ error: 'Unternehmen nicht gefunden.' }, { status: 404 })
      }
      if (user.role !== 'subunternehmer') {
        await client.query('ROLLBACK')
        return NextResponse.json({ error: 'Nur Unternehmerkonten können hier gelöscht werden.' }, { status: 400 })
      }

      companyName = user.company_name

      // Serverseitige Bestätigungsprüfung – die einzige, die zählt. Eine rein clientseitige
      // Prüfung wäre durch einen direkten API-Aufruf trivial umgehbar. Läuft bewusst VOR der
      // Idempotenz-Prüfung: auch ein wiederholter Löschversuch auf ein bereits gelöschtes Konto
      // muss den korrekten Firmennamen verlangen, sonst wäre die Bestätigung bei einem zweiten
      // Aufruf faktisch wirkungslos.
      if (confirmationName !== companyName) {
        await client.query('ROLLBACK')
        return NextResponse.json({ error: 'Der eingegebene Firmenname stimmt nicht überein.' }, { status: 400 })
      }

      // Idempotenz: ein zweiter Löschversuch mit korrektem Namen auf ein bereits gelöschtes Konto
      // ist ein No-op-Erfolg, keine erneute Nebenwirkung (kein zweiter Audit-Log-Eintrag, keine
      // zweite Anonymisierung, kein erneuter Blob-/Matching-Lauf).
      if (user.deleted_at) {
        await client.query('ROLLBACK')
        return NextResponse.json({ ok: true, alreadyDeleted: true })
      }

      if (user.subscription_status === 'active' || user.subscription_status === 'past_due') {
        await client.query('ROLLBACK')
        return NextResponse.json(
          {
            error:
              'Das Unternehmen kann nicht gelöscht werden, solange ein aktives oder überfälliges Abonnement besteht. Bitte kündigen Sie das Abonnement zuerst.',
          },
          { status: 409 }
        )
      }

      // qualification_files-Metadaten VOR dem Löschen ermitteln – die Blob-Objekte selbst werden
      // erst nach erfolgreichem Commit gelöscht (siehe unten), die DB-Zeilen aber bereits jetzt,
      // innerhalb derselben Transaktion wie die Anonymisierung.
      const filesResult = await client.query(
        `SELECT pathname FROM private_files WHERE uploaded_by = $1 AND purpose = 'qualification_file'`,
        [userId]
      )
      qualificationFilePathnames = filesResult.rows.map((r) => r.pathname)
      await client.query(`DELETE FROM private_files WHERE uploaded_by = $1 AND purpose = 'qualification_file'`, [userId])

      const anonymizedEmail = `deleted-${randomUUID()}@deleted.invalid`
      // Zufälliger, korrekt gehashter (aber niemandem bekannter) Wert statt eines erfundenen
      // "ungültigen" Strings – verhindert Login zuverlässig, ohne verifyPassword()/bcrypt mit
      // einem Format konfrontieren zu müssen, das es nicht parsen kann.
      const invalidPasswordHash = await hashPassword(`${randomUUID()}${randomUUID()}`)

      await client.query(
        `UPDATE users SET
           email = $1,
           password_hash = $2,
           phone = NULL,
           qualification_files = '[]',
           gewerke = '{}',
           verified_gewerke = '{}',
           blocked_gewerke = '{}',
           stripe_customer_id = NULL,
           stripe_subscription_id = NULL,
           subscription_status = 'inactive',
           directory_listed = false,
           company_slug = NULL,
           account_status = 'deleted',
           deleted_at = now()
         WHERE id = $3`,
        [anonymizedEmail, invalidPasswordHash, userId]
      )

      await client.query('COMMIT')
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }

    // Erst NACH erfolgreichem Commit: Audit-Log (keine Passwörter/Tokens/Stripe-Secrets, nur
    // IDs/Firmenname/Aktion), Re-Matching und Blob-Löschung – alle drei best-effort/isoliert,
    // ein Fehler hier darf die bereits erfolgreiche Anonymisierung nicht in Frage stellen.
    await logAdminAction(admin.id, 'PROVIDER_DELETED', 'user', userId, { companyName }, req)

    // Matching-Lifecycle: dieselbe Funktion wie bei einer Sperrung (siehe status/route.ts) –
    // invalidiert bestehende Matches über den bereits vorhandenen Hard-Filter
    // (filterProviderForJob prüft accountStatus, 'deleted' !== 'active' schließt genau wie
    // 'suspended' aus). Keine neue Matching-Logik, keine gelöschten match_notifications.
    try {
      await matchProviderAgainstOpenJobs(userId)
    } catch (err) {
      console.error('Provider-Matching nach Löschung fehlgeschlagen:', userId, err)
      captureError(err, { userId, operation: 'provider_matching_after_deletion' })
    }

    for (const pathname of qualificationFilePathnames) {
      try {
        await del(pathname)
      } catch (err) {
        console.error('Blob-Löschung für gelöschtes Unternehmen fehlgeschlagen:', pathname, err)
        captureError(err, { userId, operation: 'delete_qualification_file_blob' })
      }
    }

    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    return handleApiError(err, 'Löschung konnte nicht durchgeführt werden.')
  }
}

import type { PoolClient } from 'pg'
import { getDb } from '@/lib/db'
import { captureError } from '@/lib/observability/sentry'

/**
 * Phase 2F.2 – Serialisierung konkurrierender POST/DELETE-Aufrufe für denselben Nutzer am
 * Jahrespaket-Kündigungs-Endpunkt (`cancel-yearly/route.ts`). Behebt die in Phase 2F.1
 * dokumentierte Race Condition: beide Requests führen je einen Stripe-Aufruf UND einen lokalen
 * DB-Write aus, ohne Transaktionsklammer zwischen beiden – bei echter Parallelität können sich
 * die beiden Requests so verschränken, dass Stripe und lokale DB am Ende unterschiedliche
 * Endzustände zeigen.
 *
 * Lösung: eine PostgreSQL Session-Advisory-Lock auf einer EIGENEN, dedizierten Pool-Verbindung
 * (nicht über die geteilte `getDb().query()`-Schnittstelle) – eine Advisory-Lock ist an die
 * konkrete Datenbank-Session gebunden, `pg_advisory_unlock()` MUSS auf derselben Session erfolgen
 * wie `pg_try_advisory_lock()`. Die eigentliche Geschäftslogik (Stripe-Aufruf + DB-Write) läuft
 * weiterhin über die geteilte Pool-Schnittstelle – nur der Lock selbst braucht die dedizierte
 * Verbindung.
 *
 * `pg_try_advisory_lock` statt der blockierenden Variante: ein zweiter, sich überschneidender
 * Request für denselben Nutzer soll sofort einen klaren 409-Konflikt erhalten, statt eine
 * Pool-Verbindung über eine unbestimmte Zeit (bis zur Dauer eines externen Stripe-Netzwerkaufrufs
 * des ERSTEN Requests) blockierend zu belegen.
 *
 * `hashtextextended(text, seed)` erzeugt deterministisch einen bigint-Lock-Key aus der
 * (UUID-)Nutzer-ID – verfügbar seit PostgreSQL 11, kein JS-seitiges Hashing nötig. Der Seed
 * (LOCK_SEED) wirkt als fester Namensraum-Salt, damit dieser Lock-Key niemals mit einem
 * eventuellen künftigen Advisory-Lock an anderer Stelle im Code kollidiert (zum Zeitpunkt dieser
 * Änderung per Grep verifiziert: es gibt im gesamten Repository noch keine andere Advisory-Lock-
 * Verwendung). Eine – durch die Hash-Funktion extrem unwahrscheinliche – Kollision zwischen zwei
 * UNTERSCHIEDLICHEN Nutzer-IDs hätte im ungünstigsten Fall einen fälschlichen 409 für den jeweils
 * zweiten betroffenen Nutzer zur Folge (ein sicherer, bloß unnötiger Fehlschlag) – niemals einen
 * verpassten/übersprungenen Lock. Kein Sicherheitsrisiko, nur eine theoretische, extrem seltene
 * Komfort-Einschränkung.
 */
const LOCK_SEED = 0x42415556 // "BAUV" als ASCII-Werte, rein als fester Namensraum-Salt – keine Bedeutung über die Eindeutigkeit hinaus.

export const LOCK_UNAVAILABLE = Symbol('cancellation-lock-unavailable')
export const LOCK_SETUP_FAILED = Symbol('cancellation-lock-setup-failed')

/**
 * Führt `fn` serialisiert pro `userId` aus. Rückgabewerte:
 * - das Ergebnis von `fn()`, wenn der Lock erfolgreich gehalten wurde (Lock wird danach in jedem
 *   Fall freigegeben, auch wenn `fn()` wirft – der Fehler wird unverändert weitergereicht).
 * - `LOCK_UNAVAILABLE`, wenn ein anderer Request für denselben Nutzer den Lock bereits hält.
 *   WICHTIG: in diesem Fall wird `fn()` NIEMALS aufgerufen – es findet also garantiert kein
 *   zweiter Stripe-Aufruf statt, solange der erste noch läuft.
 * - `LOCK_SETUP_FAILED`, wenn keine dedizierte Verbindung aufgebaut werden konnte (Pool
 *   erschöpft/DB nicht erreichbar). Auch hier wird `fn()` NIEMALS aufgerufen – ohne Lock-Garantie
 *   darf kein Stripe-Aufruf versucht werden, ein sicherer Fehlschlag ist besser als ein
 *   ungeschützter Versuch.
 *
 * Verbindungsverlust während `fn()` läuft: PostgreSQL gibt eine Session-Advisory-Lock automatisch
 * frei, sobald die haltende Verbindung geschlossen wird – ein abgebrochener Request kann also
 * niemals einen Lock dauerhaft blockiert zurücklassen. Ein nachfolgender Request für denselben
 * Nutzer kann den Lock dann wieder regulär erwerben (kontrolliertes Verhalten, kein doppelter
 * unkontrollierter Zustandswechsel, da der abgebrochene Request per Definition keinen
 * erfolgreichen Stripe-Aufruf mehr abschließen konnte, sobald die Verbindung weg ist – der
 * eigentliche Stripe-Aufruf läuft ohnehin über die geteilte Pool-Query-Schnittstelle, nicht über
 * diese dedizierte Lock-Verbindung).
 */
export async function withYearlyCancellationLock<T>(
  userId: string,
  fn: () => Promise<T>
): Promise<T | typeof LOCK_UNAVAILABLE | typeof LOCK_SETUP_FAILED> {
  const pool = getDb()

  let client: PoolClient
  try {
    client = await pool.connect()
  } catch (err) {
    captureError(err, { userId, operation: 'cancellation_lock_connect' })
    return LOCK_SETUP_FAILED
  }

  try {
    let locked: boolean
    try {
      const result = await client.query<{ locked: boolean }>(
        'SELECT pg_try_advisory_lock(hashtextextended($1, $2)) AS locked',
        [userId, LOCK_SEED]
      )
      locked = result.rows[0]?.locked === true
    } catch (err) {
      captureError(err, { userId, operation: 'cancellation_lock_acquire' })
      return LOCK_SETUP_FAILED
    }

    if (!locked) {
      return LOCK_UNAVAILABLE
    }

    try {
      return await fn()
    } finally {
      // Unlock MUSS auf derselben Session erfolgen, auf der gelockt wurde (client, nicht pool).
      // Best-effort: schlägt der Unlock-Query selbst fehl (z.B. Verbindungsabbruch), beendet
      // PostgreSQL die Session-Advisory-Lock ohnehin automatisch beim Schließen der Verbindung –
      // siehe Funktionskommentar oben. Kein dauerhaft blockierter Lock möglich.
      try {
        await client.query('SELECT pg_advisory_unlock(hashtextextended($1, $2))', [userId, LOCK_SEED])
      } catch (err) {
        captureError(err, { userId, operation: 'cancellation_lock_release' })
      }
    }
  } finally {
    client.release()
  }
}

import type { PoolClient } from 'pg'
import { getDb } from '@/lib/db'
import { captureError, captureMessage } from '@/lib/observability/sentry'

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

/**
 * Phase 2G.2 – Standardwerte für die begrenzte Wartezeit, mit der die Admin-Kündigung
 * (`admin/users/[id]/cancel-subscription/route.ts`) denselben Lock-Schlüssel wie `cancel-yearly`
 * anzufordern versucht, BEVOR sie ohne den Lock fortfährt (siehe
 * `withAdminCancellationPriorityLock()` unten). Als benannte Konstanten statt Magic Numbers, exakt
 * nach demselben Muster wie `billing-notification-config.ts` – und als optionale Parameter
 * überschreibbar, damit Tests nicht auf echte Wartezeiten von insgesamt ~1s angewiesen sind.
 */
export const ADMIN_LOCK_RETRY_ATTEMPTS = 5
export const ADMIN_LOCK_RETRY_DELAY_MS = 200

export const LOCK_UNAVAILABLE = Symbol('cancellation-lock-unavailable')
export const LOCK_SETUP_FAILED = Symbol('cancellation-lock-setup-failed')

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function tryAcquire(client: PoolClient, userId: string): Promise<boolean> {
  const result = await client.query<{ locked: boolean }>(
    'SELECT pg_try_advisory_lock(hashtextextended($1, $2)) AS locked',
    [userId, LOCK_SEED]
  )
  return result.rows[0]?.locked === true
}

async function release(client: PoolClient, userId: string): Promise<void> {
  // Best-effort: schlägt der Unlock-Query selbst fehl (z.B. Verbindungsabbruch), beendet
  // PostgreSQL die Session-Advisory-Lock ohnehin automatisch beim Schließen der Verbindung – siehe
  // Kommentare an den Aufrufstellen. Kein dauerhaft blockierter Lock möglich.
  try {
    await client.query('SELECT pg_advisory_unlock(hashtextextended($1, $2))', [userId, LOCK_SEED])
  } catch (err) {
    captureError(err, { userId, operation: 'cancellation_lock_release' })
  }
}

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
      locked = await tryAcquire(client, userId)
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
      await release(client, userId)
    }
  } finally {
    client.release()
  }
}

/**
 * Phase 2G.2/2G.3 – Admin-Vorrang: die Admin-Kündigung (`admin/users/[id]/cancel-subscription/route.ts`)
 * fordert DENSELBEN Lock-Schlüssel wie `withYearlyCancellationLock()` an (identische
 * `hashtextextended(userId, LOCK_SEED)`-Ableitung) – beide Endpunkte serialisieren sich also
 * gegenseitig, solange beide tatsächlich den Lock halten.
 *
 * WICHTIGE KORREKTUR in Phase 2G.3: die ursprüngliche Phase-2G.2-Fassung dieser Funktion ist NACH
 * Ausschöpfen einer begrenzten Wartezeit OHNE den Lock fortgefahren ("proceed without lock"). Das
 * war KEINE verlässliche Prioritätsgarantie, sondern nur eine Wahrscheinlichkeitsannahme über die
 * Zeitstempel-Reihenfolge (siehe Phase-2G.2-Bericht) – eine begrenzte Wartezeit allein garantiert
 * keine Priorität. Diese Fassung fährt NIEMALS mehr ohne den tatsächlich gehaltenen Lock fort:
 *
 * - Gelingt der Erwerb innerhalb der begrenzten Anzahl von Versuchen
 *   (`ADMIN_LOCK_RETRY_ATTEMPTS`/`ADMIN_LOCK_RETRY_DELAY_MS`, als Parameter für Tests
 *   überschreibbar) – der Normalfall, da eine konkurrierende Nutzeraktion den Lock nur für die
 *   kurze Dauer ihres eigenen Stripe-Aufrufs + lokalen Writes hält –, läuft `fn()` vollständig
 *   lock-geschützt. Echte Gleichzeitigkeit mit einer anderen Lock-haltenden Aktion (Nutzer ODER
 *   ein zweiter Admin-Request) ist dann ausgeschlossen, nicht nur wahrscheinlich vermieden.
 * - Wird der Lock auch nach allen Versuchen nicht erhalten, gibt diese Funktion `LOCK_UNAVAILABLE`
 *   zurück – `fn()` wird dann NIEMALS aufgerufen, es findet also garantiert KEIN Stripe-Aufruf
 *   statt, solange die Lock-Belegung durch eine andere Aktion fortbesteht. Der Aufrufer
 *   (`admin/users/[id]/cancel-subscription/route.ts`) antwortet in diesem Fall kontrolliert mit
 *   409 – eine Admin-Kündigung "scheitert" damit zwar im Sinne dieses einzelnen Requests, aber NIE
 *   unkontrolliert oder mit einem doppelten/konkurrierenden Stripe-Aufruf; ein erneuter Versuch
 *   (Retry durch den Admin) ist jederzeit sicher möglich, da kein Stripe-Aufruf verloren oder
 *   doppelt ausgeführt wurde.
 *
 * Diese Funktion erkauft die (seltene) Möglichkeit eines kontrollierten 409 für den Admin-Request
 * selbst als Preis für eine tatsächlich garantierte, nicht nur wahrscheinliche
 * Serialisierung – siehe Phase-2G.3-Bericht, Abschnitt "Lock-Konzept", für die ausführliche
 * Begründung dieser Produktentscheidung.
 *
 * Gibt `LOCK_SETUP_FAILED` zurück, wenn nicht einmal eine dedizierte Verbindung aufgebaut werden
 * konnte (Pool erschöpft/DB nicht erreichbar) – auch hier wird `fn()` NICHT aufgerufen.
 */
export async function withAdminCancellationPriorityLock<T>(
  userId: string,
  fn: () => Promise<T>,
  options?: { retryAttempts?: number; retryDelayMs?: number }
): Promise<T | typeof LOCK_UNAVAILABLE | typeof LOCK_SETUP_FAILED> {
  const retryAttempts = options?.retryAttempts ?? ADMIN_LOCK_RETRY_ATTEMPTS
  const retryDelayMs = options?.retryDelayMs ?? ADMIN_LOCK_RETRY_DELAY_MS

  const pool = getDb()
  let client: PoolClient
  try {
    client = await pool.connect()
  } catch (err) {
    captureError(err, { userId, operation: 'admin_cancellation_lock_connect' })
    return LOCK_SETUP_FAILED
  }

  try {
    let holdsLock = false
    let acquireFailed = false
    for (let attempt = 0; attempt < retryAttempts; attempt++) {
      try {
        holdsLock = await tryAcquire(client, userId)
      } catch (err) {
        captureError(err, { userId, operation: 'admin_cancellation_lock_acquire' })
        // Die Lock-Abfrage selbst ist fehlgeschlagen (z.B. Verbindungsproblem auf dieser Session) –
        // ein weiterer Versuch über dieselbe Verbindung ist sinnlos, sofortiger Ausstieg aus der
        // Retry-Schleife. `holdsLock` bleibt `false`; unten wird dies wie "Lock nicht erhalten"
        // behandelt (LOCK_SETUP_FAILED, NICHT ohne Lock fortgefahren).
        acquireFailed = true
        break
      }
      if (holdsLock) break
      if (attempt < retryAttempts - 1) {
        await sleep(retryDelayMs)
      }
    }

    if (acquireFailed) {
      return LOCK_SETUP_FAILED
    }

    if (!holdsLock) {
      // Lock nach Ausschöpfen aller Versuche weiterhin belegt – KEIN Fortfahren ohne Lock mehr
      // (Phase 2G.3-Korrektur). Kontrollierter Fehlschlag statt ungeschütztem Stripe-Aufruf.
      captureMessage('admin_cancellation_lock: Lock nach allen Versuchen weiterhin belegt, Vorgang kontrolliert abgebrochen', {
        userId,
        operation: 'admin_cancellation_lock_unavailable',
      })
      return LOCK_UNAVAILABLE
    }

    try {
      return await fn()
    } finally {
      await release(client, userId)
    }
  } finally {
    client.release()
  }
}

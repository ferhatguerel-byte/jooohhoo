import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { requireAdminApi } from '@/lib/authorization'
import { handleApiError } from '@/lib/api-error'
import { logAdminAction } from '@/lib/admin-audit'
import { getStripe } from '@/lib/stripe'
import { applySubscriptionDeleted } from '@/lib/billing/subscription-state'
import { withAdminCancellationPriorityLock, LOCK_UNAVAILABLE, LOCK_SETUP_FAILED } from '@/lib/billing/cancellation-lock'
import { captureError, captureMessage } from '@/lib/observability/sentry'

/**
 * Phase 2G.1/2G.2/2G.3 – Admin-Kündigung mit serverseitig erzwungenem Vorrang.
 *
 * Produktentscheidung (verbindlich): eine autorisierte Admin-Kündigung beendet die
 * Stripe-Subscription sofort und hat Vorrang vor einer Nutzeraktion auf `cancel-yearly`
 * (planbare Jahreskündigung oder deren Rückzug). Eine mit einer laufenden Admin-Kündigung
 * kollidierende Nutzeraktion wird mit 409 abgewiesen, OHNE einen eigenen Stripe-Aufruf
 * auszulösen (siehe `cancel-yearly/route.ts`, unverändert aus Phase 2F.2). Ein bereits laufender
 * Nutzer-Request darf eine abgeschlossene Admin-Kündigung nicht nachträglich zurückziehen.
 *
 * Umsetzung in zwei voneinander unabhängigen, sich ergänzenden Bausteinen:
 *
 * 1. GEMEINSAME Lock-Serialisierung: `withAdminCancellationPriorityLock()` fordert DENSELBEN
 *    Lock-Schlüssel wie `withYearlyCancellationLock()` an (siehe cancellation-lock.ts). Hält eine
 *    Nutzeraktion diesen Lock bereits, versucht diese Funktion eine BEGRENZTE Anzahl von Malen,
 *    ihn ebenfalls zu erwerben. Phase 2G.3-Korrektur: gelingt das innerhalb dieser Versuche NICHT,
 *    fährt diese Route NICHT MEHR ohne den Lock fort (das war die in Phase 2G.2 identifizierte,
 *    nur wahrscheinliche statt garantierte Absicherung) – stattdessen wird der Vorgang
 *    KONTROLLIERT mit 409 abgebrochen, OHNE dass ein Stripe-Aufruf stattgefunden hat. Ein erneuter
 *    Versuch durch den Admin ist dann jederzeit sicher (kein verlorener/doppelter Stripe-Aufruf).
 *
 * 2. ORDERING-GUARD: wird der Lock gehalten, schreibt diese Route lokal ausschließlich über
 *    `applySubscriptionDeleted()` (dieselbe Funktion, die auch der
 *    `customer.subscription.deleted`-Webhook-Handler nutzt) – mit einem Zeitstempel, der VOR dem
 *    Stripe-Aufruf erfasst wird. Dadurch kann (a) diese Route nie einen bereits per Webhook
 *    geschriebenen, nachweislich neueren Zustand überschreiben, UND (b) der zugehörige (oder ein
 *    noch späteres) `customer.subscription.deleted`-Webhook nie fälschlich als veraltet verworfen
 *    werden. Dieser Ordering-Guard ist eine ZUSÄTZLICHE Absicherung der Schreibreihenfolge –
 *    seit Phase 2G.3 NICHT mehr die einzige Verteidigungslinie gegen eine Überschneidung mit einer
 *    Nutzeraktion, da die Lock-Serialisierung jetzt selbst schon echte Gleichzeitigkeit
 *    ausschließt (siehe Phase-2G.3-Bericht, Abschnitt "Lock-Konzept").
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: userId } = await params
  try {
    const admin = await requireAdminApi()
    const db = getDb()
    const target = await db.query<{ stripe_subscription_id: string | null; subscription_status: string }>(
      'SELECT stripe_subscription_id, subscription_status FROM users WHERE id = $1',
      [userId]
    )
    if (target.rows.length === 0) {
      return NextResponse.json({ error: 'Nutzer nicht gefunden.' }, { status: 404 })
    }
    const subscriptionId = target.rows[0].stripe_subscription_id

    // Phase 2G.2: eine bereits abgeschlossene Kündigung (vorheriger erfolgreicher Admin- oder
    // Webhook-Vorgang) wird nicht erneut gegen Stripe ausgeführt – schützt gegen den häufigsten
    // Fall einer doppelten Admin-Anfrage (versehentlicher Doppelklick, ein zweiter Request NACH
    // vollständigem Abschluss des ersten). Deckt NICHT echte Gleichzeitigkeit zweier Admin-
    // Requests ab, die beide VOR dem jeweils anderen Schreibvorgang lesen – dafür sorgt die
    // Lock-Serialisierung unten (mit der oben dokumentierten, bewusst begrenzten Ausnahme).
    if (target.rows[0].subscription_status === 'canceled') {
      return NextResponse.json({ ok: true, alreadyCanceled: true })
    }

    const result = await withAdminCancellationPriorityLock(userId, () =>
      performAdminCancellation(admin.id, userId, subscriptionId, req)
    )
    if (result === LOCK_UNAVAILABLE) {
      // Phase 2G.3: kontrollierter Abbruch statt eines ungeschützten Stripe-Aufrufs ohne Lock –
      // kein Stripe-Call wurde ausgelöst, ein erneuter Versuch ist sicher.
      return NextResponse.json(
        { error: 'Für dieses Abo läuft bereits eine andere Kündigungsänderung. Bitte in Kürze erneut versuchen.' },
        { status: 409 }
      )
    }
    if (result === LOCK_SETUP_FAILED) {
      return NextResponse.json(
        { error: 'Die Anfrage konnte derzeit nicht verarbeitet werden. Bitte später erneut versuchen.' },
        { status: 503 }
      )
    }
    return result
  } catch (err: unknown) {
    return handleApiError(err, 'Kündigung konnte nicht durchgeführt werden.')
  }
}

async function performAdminCancellation(
  adminId: string,
  userId: string,
  subscriptionId: string | null,
  req: NextRequest
): Promise<NextResponse> {
  // Zeitstempel VOR dem Stripe-Aufruf erfasst (nicht danach!) – siehe Dateikommentar oben und
  // Phase-2F.2-Begründung in cancel-yearly/route.ts. Verhindert, dass diese Route das zugehörige
  // `customer.subscription.deleted`-Webhook-Event fälschlich als veraltet erscheinen lässt.
  const guardTimestamp = new Date()

  if (subscriptionId) {
    const stripe = getStripe()
    // Stripe-Fehler: wirft unverändert in den äußeren catch (handleApiError) – keine lokale
    // Änderung, kein Audit-Log-Eintrag (die Aktion hat faktisch nicht stattgefunden).
    await stripe.subscriptions.cancel(subscriptionId)
  }

  // Audit-Log SOFORT nach dem (ggf. gar nicht nötigen, falls keine Subscription existierte)
  // erfolgreichen Stripe-Aufruf – UNABHÄNGIG vom Ergebnis des nachfolgenden lokalen
  // Schreibvorgangs. logAdminAction() wirft laut eigenem Vertrag nie (siehe admin-audit.ts); ein
  // Fehler dort darf den bereits erfolgten Stripe-Aufruf aber ohnehin nicht verschleiern – deshalb
  // hier aufgerufen, BEVOR überhaupt versucht wird, den lokalen Zustand zu schreiben.
  await logAdminAction(adminId, 'SUBSCRIPTION_CHANGED', 'user', userId, { action: 'admin_canceled' }, req)

  const writeOutcome = await writeAdminCancellation(userId, guardTimestamp)
  if (writeOutcome !== 'applied') {
    return buildStripeSucceededButLocalWriteUncertainResponse(userId, writeOutcome)
  }

  return NextResponse.json({ ok: true })
}

type LocalWriteOutcome = 'applied' | 'db_error' | 'guard_skipped'

/**
 * Schreibt den Kündigungszustand ausschließlich über `applySubscriptionDeleted()` (siehe
 * subscription-state.ts) – dieselbe, bereits bestehende und getestete Ordering-Guard-Funktion,
 * die auch der Webhook-Handler für `customer.subscription.deleted` nutzt. Keine zweite,
 * eigenständige UPDATE-Formulierung in dieser Route (Audit-Vorgabe: keine zweite State-Machine).
 */
async function writeAdminCancellation(userId: string, guardTimestamp: Date): Promise<LocalWriteOutcome> {
  try {
    const applied = await applySubscriptionDeleted(getDb(), { userId, eventCreatedAt: guardTimestamp })
    if (!applied) {
      // Stripe wurde bereits erfolgreich aktualisiert; der Ordering-Guard hat die Zeile aber als
      // bereits aktueller als dieser Request erkannt (z.B. ein nahezu gleichzeitiger Webhook).
      // Bewusst NICHT erzwungen überschrieben.
      captureMessage('admin_cancel_subscription: lokaler Schreibvorgang durch Ordering-Guard übersprungen', {
        userId,
        operation: 'admin_cancel_subscription_guard_skipped',
      })
      return 'guard_skipped'
    }
    return 'applied'
  } catch (err) {
    captureError(err, { userId, operation: 'admin_cancel_subscription_db_write_after_stripe_success' })
    return 'db_error'
  }
}

/**
 * Stripe wurde in jedem Fall bereits erfolgreich aktualisiert (Subscription gelöscht) – nur die
 * lokale Bestätigung ist entweder fehlgeschlagen (`db_error`) oder unsicher/übersprungen
 * (`guard_skipped`). In BEIDEN Fällen: KEINE Meldung, die einen vollständigen Fehlschlag bei
 * Stripe suggeriert – Stripe hat die Subscription bereits unwiderruflich gelöscht. KEIN
 * automatischer Retry des Stripe-Aufrufs hier (der wäre bei `db_error` ohnehin unnötig, da Stripe
 * bereits erfolgreich war – ein erneuter `subscriptions.cancel()`-Aufruf auf eine bereits
 * gelöschte Subscription liefe ins Leere oder würde einen Stripe-Fehler erzeugen). Die
 * Selbstheilung über das zugehörige Webhook wird hier NICHT als garantiert oder fristgebunden
 * dargestellt.
 */
function buildStripeSucceededButLocalWriteUncertainResponse(userId: string, outcome: LocalWriteOutcome): NextResponse {
  console.error('Admin-Kündigung bei Stripe durchgeführt, lokale Bestätigung aber nicht gesichert:', userId, outcome)
  return NextResponse.json(
    {
      error:
        'Die Kündigung wurde bei unserem Zahlungsdienstleister bereits durchgeführt, konnte lokal aber noch nicht sicher bestätigt werden. Die Synchronisierung erfolgt automatisch, sobald möglich – es gibt dafür keine garantierte Frist.',
      stripeUpdated: true,
    },
    { status: 500 }
  )
}

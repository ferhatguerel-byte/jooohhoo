import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { requireActiveUserApi } from '@/lib/authorization'
import type { CurrentUser } from '@/lib/current-user'
import { getStripe } from '@/lib/stripe'
import { computeCancellationEffectiveDate } from '@/lib/subscription-term'
import { handleApiError } from '@/lib/api-error'
import { enqueueBillingNotification } from '@/lib/billing/billing-notification-outbox'
import { captureError, captureMessage } from '@/lib/observability/sentry'
import { TIERS } from '@/lib/tiers'
import { withYearlyCancellationLock, LOCK_UNAVAILABLE, LOCK_SETUP_FAILED } from '@/lib/billing/cancellation-lock'

/**
 * Phase 2F.1/2F.2 – ehemals dokumentierte, jetzt behobene Race Condition: ruft ein Nutzer nahezu
 * gleichzeitig POST (kündigen) und DELETE (Kündigung zurückziehen) auf, serialisiert
 * `withYearlyCancellationLock()` (siehe dort) beide Requests pro Nutzer über eine PostgreSQL
 * Session-Advisory-Lock – ein sich überschneidender zweiter Request erhält sofort 409, OHNE dass
 * dessen Stripe-Aufruf überhaupt ausgeführt wird. Dadurch können sich die beiden (Stripe-Call +
 * lokaler DB-Write)-Schrittpaare nicht mehr verschränken.
 *
 * Diese Serialisierung gilt ausschließlich zwischen POST/DELETE dieses Endpunkts für DENSELBEN
 * Nutzer. Sie schützt NICHT gegen eine echte zeitliche Überschneidung mit einem unabhängigen
 * Stripe-Webhook oder einer Admin-Kündigung (`admin/users/[id]/cancel-subscription/route.ts`) –
 * dafür sorgt stattdessen der Ordering-Guard auf `subscription_state_updated_at` (siehe unten und
 * `src/lib/billing/subscription-state.ts`), unverändert dieselbe Semantik wie im Webhook-Handler.
 */
export async function POST() {
  try {
    // requireActiveUserApi(): ein gesperrtes/gelöschtes Konto darf über eine noch gültige Session
    // seine Stripe-Kündigung nicht mehr selbst verwalten (sicherheitsrelevante Kontoänderung).
    const user = await requireActiveUserApi()
    if (user.role !== 'subunternehmer') {
      return NextResponse.json({ error: 'Kein Zugriff.' }, { status: 403 })
    }
    if (!user.stripeSubscriptionId || !user.subscriptionCommittedUntil) {
      return NextResponse.json({ error: 'Kein Jahrespaket-Abo mit Mindestlaufzeit gefunden.' }, { status: 404 })
    }

    const result = await withYearlyCancellationLock(user.id, () => performCancellation(user))
    return respondToLockResult(result)
  } catch (err: unknown) {
    return handleApiError(err, 'Kündigung konnte nicht eingereicht werden.')
  }
}

export async function DELETE() {
  try {
    // requireActiveUserApi(): siehe POST oben.
    const user = await requireActiveUserApi()
    if (user.role !== 'subunternehmer') {
      return NextResponse.json({ error: 'Kein Zugriff.' }, { status: 403 })
    }
    if (!user.stripeSubscriptionId) {
      return NextResponse.json({ error: 'Kein Abo gefunden.' }, { status: 404 })
    }

    const result = await withYearlyCancellationLock(user.id, () => performWithdrawal(user))
    return respondToLockResult(result)
  } catch (err: unknown) {
    return handleApiError(err, 'Kündigung konnte nicht zurückgezogen werden.')
  }
}

function respondToLockResult(result: NextResponse | typeof LOCK_UNAVAILABLE | typeof LOCK_SETUP_FAILED): NextResponse {
  if (result === LOCK_UNAVAILABLE) {
    return NextResponse.json(
      { error: 'Es läuft bereits eine Kündigungsänderung für dieses Abo. Bitte in Kürze erneut versuchen.' },
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
}

async function performCancellation(user: CurrentUser): Promise<NextResponse> {
  const requestedAt = new Date()
  const effectiveDate = computeCancellationEffectiveDate(new Date(user.subscriptionCommittedUntil!))
  const cancelAtUnix = Math.floor(effectiveDate.getTime() / 1000)

  // Zeitstempel VOR dem Stripe-Aufruf erfasst (nicht danach!): Stripe erzeugt das zugehörige
  // `customer.subscription.updated`-Webhook-Event ausschließlich WÄHREND der Verarbeitung dieses
  // Aufrufs – also zwingend NACH diesem Zeitpunkt (unter der Annahme hinreichend synchroner
  // Server-/Stripe-Uhren, siehe Phase-2F.2-Bericht). Als `subscription_state_updated_at`
  // verwendet, kann dieser Direkt-Schreibpfad das zugehörige (oder ein noch späteres)
  // Webhook-Event dadurch NIE fälschlich als veraltet erscheinen lassen – anders als ein nach dem
  // Stripe-Aufruf erfasstes `now()` (vgl. den bestehenden, an dieser Stelle NICHT übernommenen
  // Zeitstempel-Zeitpunkt in `admin/users/[id]/cancel-subscription/route.ts`).
  const guardTimestamp = new Date()

  const stripe = getStripe()
  // Stripe-Fehler: wirft unverändert an den äußeren catch (handleApiError) – die lokale DB wird in
  // diesem Fall nie erreicht, es entsteht keine lokale Zustandsänderung (Phase 2F.1, Abschnitt 1,
  // unverändert bestätigt).
  await stripe.subscriptions.update(user.stripeSubscriptionId!, { cancel_at: cancelAtUnix })

  const writeOutcome = await writeLocalCancelAt(user.id, effectiveDate, guardTimestamp)
  if (writeOutcome !== 'applied') {
    return buildStripeSucceededButLocalWriteUncertainResponse(user.id, writeOutcome)
  }

  // Phase 2B (Aufgabe 2): Kündigungsbestätigung als Outbox-Eintrag – ein fehlgeschlagener
  // E-Mail-Versand darf die bereits wirksame Kündigung (Stripe + lokale DB bereits oben
  // geschrieben) weder rückgängig machen noch dem Nutzer fälschlich als Fehler angezeigt werden.
  // enqueueBillingNotification() wirft laut eigenem Vertrag nie (siehe
  // billing-notification-outbox.ts) – dieses try/catch ist eine zusätzliche, bewusste
  // Absicherung. dedupeKey an user+effectiveDate gebunden: ein erneuter POST mit unverändertem
  // Laufzeitende erzeugt nie eine zweite Bestätigung.
  if (user.subscriptionTier) {
    try {
      await enqueueBillingNotification({
        userId: user.id,
        kind: 'cancellation_confirmation',
        dedupeKey: `cancellation_confirmation:${user.id}:${effectiveDate.toISOString()}`,
        payload: {
          tierName: TIERS[user.subscriptionTier].name,
          requestedAt: requestedAt.toISOString(),
          effectiveAt: effectiveDate.toISOString(),
        },
      })
    } catch (err) {
      console.error('Kündigungsbestätigungs-Outbox-Eintrag fehlgeschlagen:', user.id, err)
      captureError(err, { userId: user.id, operation: 'billing_notification_enqueue_after_cancellation' })
    }
  }

  return NextResponse.json({ ok: true, cancelAt: effectiveDate.toISOString() })
}

async function performWithdrawal(user: CurrentUser): Promise<NextResponse> {
  // Siehe performCancellation() oben für die Begründung, warum der Zeitstempel VOR dem
  // Stripe-Aufruf erfasst wird.
  const guardTimestamp = new Date()

  const stripe = getStripe()
  await stripe.subscriptions.update(user.stripeSubscriptionId!, { cancel_at: null })

  const writeOutcome = await writeLocalCancelAt(user.id, null, guardTimestamp)
  if (writeOutcome !== 'applied') {
    return buildStripeSucceededButLocalWriteUncertainResponse(user.id, writeOutcome)
  }

  return NextResponse.json({ ok: true })
}

type LocalWriteOutcome = 'applied' | 'db_error' | 'guard_skipped'

/**
 * Ordering-guardeter Direkt-Schreibpfad für `subscription_cancel_at` – dieselbe WHERE-Semantik wie
 * `applySubscriptionUpdated()`/`applySubscriptionDeleted()` (`subscription_state_updated_at IS
 * NULL OR subscription_state_updated_at < $guardTimestamp`), damit dieser Pfad niemals einen
 * bereits per Webhook/Admin-Aktion geschriebenen, NEUEREN Zustand überschreibt (Phase 2F.1,
 * Abschnitt "zusätzlicher Befund"). Gibt `'guard_skipped'` zurück, wenn genau das der Fall war
 * (0 betroffene Zeilen trotz erfolgreichem Stripe-Aufruf) – das ist KEIN Fehler im Sinne einer
 * Exception, aber auch kein bestätigter Erfolg: der Aufrufer darf in diesem seltenen Fall nicht
 * behaupten, die lokale DB sei jetzt zweifelsfrei synchron.
 */
async function writeLocalCancelAt(userId: string, cancelAt: Date | null, guardTimestamp: Date): Promise<LocalWriteOutcome> {
  try {
    const result = await getDb().query(
      `UPDATE users SET subscription_cancel_at = $1, subscription_state_updated_at = $2
       WHERE id = $3 AND (subscription_state_updated_at IS NULL OR subscription_state_updated_at < $2)`,
      [cancelAt, guardTimestamp, userId]
    )
    if ((result.rowCount ?? 0) === 0) {
      // Stripe wurde bereits erfolgreich aktualisiert; der lokale Guard hat die Zeile aber als
      // bereits aktueller als dieser Request erkannt (z.B. ein nahezu gleichzeitiger Webhook/eine
      // Admin-Aktion). Bewusst NICHT erzwungen überschrieben (Vorgabe: keine Zeitstempel
      // willkürlich überschreiben, keinen nachweislich neueren Zustand verwerfen).
      captureMessage('cancel_yearly: lokaler Schreibvorgang durch Ordering-Guard übersprungen', {
        userId,
        operation: 'cancel_yearly_guard_skipped',
      })
      return 'guard_skipped'
    }
    return 'applied'
  } catch (err) {
    captureError(err, { userId, operation: 'cancel_yearly_db_write_after_stripe_success' })
    return 'db_error'
  }
}

/**
 * Stripe wurde in jedem Fall bereits erfolgreich aktualisiert – nur die lokale Bestätigung ist
 * entweder fehlgeschlagen (`db_error`) oder unsicher/übersprungen (`guard_skipped`). In BEIDEN
 * Fällen: KEINE beschönigende Erfolgsmeldung, die eine vollständige Synchronisierung suggeriert
 * (Vorgabe Aufgabe 4) – und KEIN automatischer Retry hier (ein dauerhaftes DB-Problem würde durch
 * eine sofortige Wiederholung nur denselben Fehler erneut auslösen, ohne den Nutzerzustand zu
 * verbessern; Vorgabe: keine unkontrollierten Wiederholungen). Die Selbstheilung über das
 * zugehörige `customer.subscription.updated`-Webhook (siehe Phase 2F.1) wird hier ausdrücklich
 * NICHT als garantiert oder fristgebunden dargestellt – daher 500/Fehlertext statt 200/ok, obwohl
 * Stripe faktisch bereits den gewünschten Zustand hat.
 */
function buildStripeSucceededButLocalWriteUncertainResponse(userId: string, outcome: LocalWriteOutcome): NextResponse {
  console.error('Kündigung bei Stripe aktualisiert, lokale Bestätigung aber nicht gesichert:', userId, outcome)
  return NextResponse.json(
    {
      error:
        'Die Änderung wurde bei unserem Zahlungsdienstleister bereits übernommen, konnte lokal aber noch nicht sicher bestätigt werden. Bitte laden Sie die Seite in Kürze neu – eine endgültige Bestätigung erfolgt automatisch, sobald die Synchronisierung abgeschlossen ist. Es gibt dafür keine garantierte Frist.',
      stripeUpdated: true,
    },
    { status: 500 }
  )
}

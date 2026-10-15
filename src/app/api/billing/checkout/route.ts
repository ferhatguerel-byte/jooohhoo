import { createHash } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { z } from 'zod'
import { getDb } from '@/lib/db'
import type { CurrentUser } from '@/lib/current-user'
import { requireActiveUserApi } from '@/lib/authorization'
import { getStripe } from '@/lib/stripe'
import { TIERS, TIER_ORDER } from '@/lib/tiers'
import { getAppUrl } from '@/lib/url'
import { handleApiError } from '@/lib/api-error'
import { claimTierChangePreview, tierChangeIdempotencyKey } from '@/lib/billing/tier-change-preview'
import { applySubscriptionUpdated } from '@/lib/billing/subscription-state'
import { withYearlyCancellationLock, LOCK_UNAVAILABLE, LOCK_SETUP_FAILED } from '@/lib/billing/cancellation-lock'
import { captureError, captureMessage } from '@/lib/observability/sentry'

const checkoutSchema = z.object({
  tier: z.enum(TIER_ORDER as [string, ...string[]]),
  // Nur für einen Tarifwechsel bei bereits aktivem Abo erforderlich (siehe hasActiveSub-Zweig
  // unten) – ein Neuabschluss (Stripe Hosted Checkout) braucht keine Vorschau, da dort Preis und
  // Fälligkeit bereits auf der Stripe-Checkout-Seite selbst angezeigt werden.
  previewId: z.string().uuid().optional(),
})

/**
 * Deterministischer Stripe-Idempotency-Key für die Customer-Neuanlage eines Users (nie die rohe
 * userId oder E-Mail als Key selbst – gehasht, damit kein internes Datum/PII direkt sichtbar wird,
 * u.a. im Stripe-Dashboard-Log dieses Requests). Zwei praktisch gleichzeitige Checkout-Requests
 * desselben Users (Doppelklick, zwei Tabs, Client-Retry) erzeugen denselben Key -> Stripe
 * dedupliziert den zweiten `customers.create`-Aufruf serverseitig und liefert denselben Customer
 * zurück, statt einen zweiten Live-Customer anzulegen (siehe https://stripe.com/docs/api/idempotent_requests).
 */
export function stripeCustomerCreateIdempotencyKey(userId: string): string {
  return createHash('sha256').update(`checkout-customer-create:${userId}`).digest('hex')
}

/**
 * Ermittelt eine gültige Stripe-Customer-ID für den Checkout. Eine bereits lokal gespeicherte
 * `stripe_customer_id` kann ungültig sein, wenn sie aus einem anderen Stripe-Konto oder -Modus
 * stammt (z. B. Test/Sandbox statt Live) – Stripe lehnt einen Checkout mit einer solchen ID mit
 * "No such customer: cus_..." ab. Deshalb wird eine vorhandene ID vor der Verwendung verifiziert;
 * ist sie ungültig oder gelöscht, greift dieselbe Lookup-per-E-Mail/Erstellung-Logik wie beim
 * erstmaligen Checkout (verhindert doppelte Live-Customer für dieselbe E-Mail-Adresse), und die
 * neue ID wird lokal nachgezogen. Die Neuanlage ist zusätzlich per Stripe-Idempotency-Key gegen
 * echte Nebenläufigkeit abgesichert (siehe stripeCustomerCreateIdempotencyKey).
 */
async function resolveValidCustomerId(stripe: Stripe, user: CurrentUser): Promise<string> {
  if (user.stripeCustomerId) {
    try {
      const existing = await stripe.customers.retrieve(user.stripeCustomerId)
      if (!existing.deleted) return user.stripeCustomerId
    } catch (err) {
      // An dieser Stelle wird ausschließlich eine einzelne Customer-ID nachgeschlagen – JEDER
      // StripeInvalidRequestError aus genau diesem Aufruf bedeutet praktisch immer "diese
      // ID-Referenz ist ungültig" (nicht existent, falsches Format, falscher Stripe-Konto/-Modus),
      // unabhängig vom genauen `code` (der bei "No such customer" i.d.R. "resource_missing" ist,
      // aber nicht die einzige denkbare Auslöser-Klassifizierung für eine kaputte ID sein muss).
      // Andere Fehlerklassen (Auth-/Permission-/Rate-Limit-/Netzwerkfehler) sind im Stripe-SDK
      // eigene, von StripeInvalidRequestError NICHT abgeleitete Klassen und werden weiterhin
      // unverändert durchgereicht.
      if (!(err instanceof Stripe.errors.StripeInvalidRequestError)) {
        throw err
      }
      // Gespeicherte ID existiert in diesem Stripe-Konto/-Modus nicht (mehr) – unten neu auflösen.
    }
  }

  const existingCustomers = await stripe.customers.list({ email: user.email, limit: 1 })
  const customerId =
    existingCustomers.data.length > 0
      ? existingCustomers.data[0].id
      : (
          await stripe.customers.create(
            { email: user.email, name: user.companyName, metadata: { userId: user.id } },
            { idempotencyKey: stripeCustomerCreateIdempotencyKey(user.id) }
          )
        ).id

  await getDb().query('UPDATE users SET stripe_customer_id = $1 WHERE id = $2', [customerId, user.id])
  return customerId
}

export async function POST(req: NextRequest) {
  try {
    // requireActiveUserApi(): ein gesperrtes/gelöschtes Konto darf über eine noch gültige Session
    // kein neues Abo mehr abschließen (verhindert insbesondere, dass ein gelöschtes Konto sich
    // selbst re-aktiviert, ohne dass ein Admin das beabsichtigt).
    const user = await requireActiveUserApi()
    if (user.role !== 'subunternehmer') {
      return NextResponse.json({ error: 'Nur Unternehmer können ein Abo abschließen.' }, { status: 403 })
    }
    const { tier, previewId } = checkoutSchema.parse(await req.json())
    const tierDef = TIERS[tier as keyof typeof TIERS]
    const priceId = process.env[tierDef.priceEnv]

    if (!priceId) {
      return NextResponse.json({ error: 'Zahlungsanbieter ist noch nicht konfiguriert.' }, { status: 500 })
    }

    const stripe = getStripe()
    const hasActiveSub = user.subscriptionStatus === 'active' && !!user.subscriptionTier && !!user.stripeSubscriptionId

    if (hasActiveSub) {
      if (user.subscriptionTier === tier) {
        return NextResponse.json({ error: 'Sie haben dieses Abo bereits aktiv.' }, { status: 409 })
      }
      if (user.subscriptionTier === 'yearly' && tier === 'monthly') {
        return NextResponse.json(
          {
            error:
              'Ein Wechsel vom Jahrespaket zum Monatspaket ist während der laufenden 12-Monats-Laufzeit nicht möglich. Bitte kündigen Sie zunächst über "Vertrag kündigen" – nach Ablauf der Laufzeit können Sie dann frei wählen.',
          },
          { status: 409 }
        )
      }

      // Phase 2B (Aufgabe 3): ein Tarifwechsel wird NIE mehr ohne vorherige, vom Nutzer
      // ausdrücklich bestätigte Preisvorschau ausgeführt. Der Client kann den Betrag dabei nicht
      // beeinflussen – nur die serverseitig unter `previewId` gespeicherte Zeile (siehe
      // src/lib/billing/tier-change-preview.ts) entscheidet, welcher Tarif/Preis gilt. Fehlt die
      // previewId, ist sie abgelaufen, bereits verbraucht oder gehört zu einem anderen Tarif,
      // bricht der Wechsel kontrolliert ab (409) – der Client muss dann über
      // POST /api/billing/tier-change-preview eine neue Vorschau anfordern.
      if (!previewId) {
        return NextResponse.json(
          { error: 'Für einen Tarifwechsel ist eine bestätigte Preisvorschau erforderlich.' },
          { status: 400 }
        )
      }

      // Phase 2G.5: derselbe Nutzer-Lock-Schlüssel wie `cancel-yearly`/die Admin-Kündigung (siehe
      // cancellation-lock.ts) – ein Tarifwechsel ist fachlich eine weitere "Nutzeraktion auf das
      // eigene Abo", gleichrangig zu cancel-yearly POST/DELETE, OHNE eigene Priorität gegenüber
      // einer Admin-Kündigung. Serialisiert diesen Tarifwechsel gegen eine zeitgleiche
      // Admin-Kündigung oder Jahreskündigung/-Rückzug DESSELBEN Nutzers: hält eine der beiden
      // bereits den Lock, scheitert dieser Request sofort mit 409, OHNE dass der
      // `stripe.subscriptions.update()`-Aufruf unten überhaupt versucht wird – das schließt die in
      // Phase 2G.1 identifizierte Race Condition (konkurrierender Tarifwechsel überschreibt eine
      // soeben erfolgte Admin-Kündigung) auf Stripe-Call-Ebene aus, nicht nur auf DB-Write-Ebene.
      const result = await withYearlyCancellationLock(user.id, () =>
        performTierChange(stripe, user, tier as keyof typeof TIERS, tierDef, priceId, previewId, req)
      )
      if (result === LOCK_UNAVAILABLE) {
        return NextResponse.json(
          { error: 'Für dieses Abo läuft bereits eine andere Änderung. Bitte in Kürze erneut versuchen.' },
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

    const customerId = await resolveValidCustomerId(stripe, user)

    const appUrl = getAppUrl(req)

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      metadata: { userId: user.id, tier },
      subscription_data: { metadata: { userId: user.id, tier } },
      success_url: `${appUrl}/dashboard/abo?success=1`,
      cancel_url: `${appUrl}/dashboard/abo?canceled=1`,
    })

    return NextResponse.json({ url: session.url })
  } catch (err: unknown) {
    return handleApiError(err, 'Checkout konnte nicht gestartet werden.')
  }
}

async function performTierChange(
  stripe: Stripe,
  user: CurrentUser,
  tier: keyof typeof TIERS,
  tierDef: (typeof TIERS)[keyof typeof TIERS],
  priceId: string,
  previewId: string,
  req: NextRequest
): Promise<NextResponse> {
  const claimedPreview = await claimTierChangePreview(previewId, user.id, tier)
  if (!claimedPreview) {
    return NextResponse.json(
      { error: 'Die Preisvorschau ist abgelaufen oder bereits verwendet. Bitte fordern Sie eine neue Vorschau an.' },
      { status: 409 }
    )
  }

  // Bestehendes Abo (Monatspaket -> Jahrespaket) direkt umstellen, statt ein zweites Stripe-Abo
  // für dieselbe E-Mail-Adresse anzulegen und doppelt abzurechnen.
  const subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId!)
  const currentItemId = subscription.items.data[0]?.id
  if (!currentItemId) {
    return NextResponse.json({ error: 'Abo konnte nicht gefunden werden.' }, { status: 404 })
  }

  // Phase 2G.5: Zeitstempel VOR dem Stripe-Aufruf erfasst (nicht danach!) – dieselbe Begründung
  // wie in cancel-yearly/route.ts bzw. der Admin-Kündigung (Phase 2F.2/2G.2): verhindert, dass
  // dieser Direkt-Schreibpfad das zugehörige `customer.subscription.updated`-Webhook-Event
  // fälschlich als veraltet erscheinen lässt.
  const guardTimestamp = new Date()

  // Stripe-Fehler: wirft unverändert in den äußeren catch (handleApiError) – keine lokale
  // Änderung, der vorangehende claimTierChangePreview()-Verbrauch bleibt zwar bestehen (die
  // Vorschau ist "verbrannt"), das ist aber unabhängig von einer lokalen Abo-Zustandsänderung und
  // kein Sicherheitsproblem – der Nutzer fordert bei Bedarf eine neue Vorschau an.
  await stripe.subscriptions.update(
    user.stripeSubscriptionId!,
    {
      items: [{ id: currentItemId, price: priceId }],
      metadata: { userId: user.id, tier },
      proration_behavior: 'create_prorations',
    },
    // Idempotenz-Schutz zusätzlich auf Stripe-HTTP-Ebene (Verteidigung in der Tiefe): der lokale
    // atomare Claim oben verhindert bereits, dass ein Doppelklick/Parallel-Request diesen
    // Codepfad zweimal erreicht – dieser Key schützt zusätzlich gegen einen reinen
    // Netzwerk-Retry derselben bereits abgesendeten Anfrage.
    { idempotencyKey: tierChangeIdempotencyKey(claimedPreview.id) }
  )

  const writeOutcome = await writeTierChange(user.id, tier, tierDef.minimumTermMonths, guardTimestamp)
  if (writeOutcome !== 'applied') {
    return buildStripeSucceededButLocalWriteUncertainResponse(user.id, writeOutcome)
  }

  const appUrl = getAppUrl(req)
  return NextResponse.json({ url: `${appUrl}/dashboard/abo?success=1` })
}

type LocalWriteOutcome = 'applied' | 'db_error' | 'guard_skipped'

/**
 * Schreibt den Tarifwechsel ausschließlich über `applySubscriptionUpdated()` (siehe
 * subscription-state.ts) – dieselbe, bereits bestehende und getestete Ordering-Guard-Funktion,
 * die auch der `customer.subscription.updated`-Webhook-Handler nutzt. Keine zweite, eigenständige
 * UPDATE-Formulierung mehr (Phase-2G.1-Befund behoben: der vorherige, bedingungslose UPDATE ohne
 * Ordering-Guard konnte einen zwischenzeitlich neueren Zustand – insbesondere eine Admin-
 * Kündigung – ungeschützt überschreiben).
 */
async function writeTierChange(
  userId: string,
  tier: keyof typeof TIERS,
  minimumTermMonths: number,
  guardTimestamp: Date
): Promise<LocalWriteOutcome> {
  try {
    const applied = await applySubscriptionUpdated(getDb(), {
      userId,
      status: 'active',
      tier,
      cancelAt: null,
      committedUntilMonths: minimumTermMonths,
      eventCreatedAt: guardTimestamp,
    })
    if (!applied) {
      // Stripe wurde bereits erfolgreich aktualisiert; der Ordering-Guard hat die Zeile aber als
      // bereits aktueller als dieser Request erkannt (z.B. eine nahezu gleichzeitige
      // Admin-Kündigung oder ein Webhook). Bewusst NICHT erzwungen überschrieben.
      captureMessage('checkout_tier_change: lokaler Schreibvorgang durch Ordering-Guard übersprungen', {
        userId,
        operation: 'checkout_tier_change_guard_skipped',
      })
      return 'guard_skipped'
    }
    return 'applied'
  } catch (err) {
    captureError(err, { userId, operation: 'checkout_tier_change_db_write_after_stripe_success' })
    return 'db_error'
  }
}

/**
 * Stripe wurde in jedem Fall bereits erfolgreich aktualisiert (Tarif/Preis geändert) – nur die
 * lokale Bestätigung ist entweder fehlgeschlagen (`db_error`) oder unsicher/übersprungen
 * (`guard_skipped`). KEINE Meldung, die einen vollständigen Fehlschlag bei Stripe suggeriert –
 * KEIN automatischer Retry des Stripe-Aufrufs hier. Die Selbstheilung über das zugehörige Webhook
 * wird NICHT als garantiert oder fristgebunden dargestellt.
 */
function buildStripeSucceededButLocalWriteUncertainResponse(userId: string, outcome: LocalWriteOutcome): NextResponse {
  console.error('Tarifwechsel bei Stripe durchgeführt, lokale Bestätigung aber nicht gesichert:', userId, outcome)
  return NextResponse.json(
    {
      error:
        'Der Tarifwechsel wurde bei unserem Zahlungsdienstleister bereits übernommen, konnte lokal aber noch nicht sicher bestätigt werden. Bitte laden Sie die Seite in Kürze neu – eine endgültige Bestätigung erfolgt automatisch, sobald die Synchronisierung abgeschlossen ist. Es gibt dafür keine garantierte Frist.',
      stripeUpdated: true,
    },
    { status: 500 }
  )
}

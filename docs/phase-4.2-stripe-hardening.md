# Phase 4.2 – Stripe Production Hardening

Härtung der bestehenden Stripe-Subscription-Integration (Idempotenz, Event-Ordering,
`invoice.payment_failed`, Reconciliation-Fallback). Kein Konzeptwechsel bei Matching, Rate
Limiting, Observability, Legal oder File-Authorization – siehe jeweilige bestehende Doku dazu.

## 1. Stripe Source of Truth

- **Stripe** ist die alleinige Quelle der Wahrheit für den Billing-Zustand (Subscription-Status,
  Tarif, Kündigungsdatum).
- Die **lokale DB** (`users.subscription_status`/`subscription_tier`/`subscription_cancel_at`) ist
  ein gecachter, für den produktiven Zugriff optimierter Spiegel dieses Zustands.
- Der **Webhook** (`/api/billing/webhook`) ist der primäre Synchronisationsmechanismus.
- Die **Reconciliation** (`reconcileUserStripeSubscription()`) ist der Fallback für den Fall, dass
  der Webhook (noch) nicht angekommen ist oder der lokale Zustand aus anderen Gründen veraltet
  sein könnte.
- Keine lokale Änderung widerspricht Stripe dauerhaft. Die einzigen bewusst temporären
  Abweichungen sind: (a) die kurze Lücke zwischen Checkout-Abschluss und Webhook-Zustellung
  (durch die Reconciliation in `dashboard/abo/page.tsx` minimiert) und (b) optimistische
  sofortige Schreibungen bei direkten Nutzeraktionen (Tarifwechsel, Admin-Kündigung), die
  unmittelbar von Stripe selbst per API ausgelöst wurden und durch den nachfolgenden Webhook
  bestätigt werden.

## 2. Unterstützte Events

| Event | Verarbeitung |
|---|---|
| `checkout.session.completed` | Aktiviert das Abo – nur wenn `session.subscription` vorhanden UND `payment_status === 'paid'` (Teil I). |
| `customer.subscription.updated` | Status-/Tier-/Kündigungs-Mapping neu, zentralisiert (Teil G). |
| `customer.subscription.deleted` | Setzt lokal `canceled`, `cancel_at = NULL` (Teil H). |
| `invoice.payment_failed` | **Neu (Teil F).** Ruft die betroffene Subscription live bei Stripe ab und wendet denselben Status-/Tier-Mapping-Code wie `subscription.updated` an – keine zweite State-Machine. |
| alle anderen | werden ignoriert, aber als `processed` markiert (kein Fehler). |

## 3. Lokale State-Machine (Teil E)

Unverändert aus dem bisherigen Code übernommen, nur zentralisiert in
`src/lib/billing/subscription-state.ts` (`mapStripeSubscriptionStatus`):

| Stripe-Status | Lokaler Status |
|---|---|
| `active` | `active` |
| `past_due` | `past_due` |
| `trialing`, `unpaid`, `incomplete`, `incomplete_expired`, `canceled`, `paused` | `inactive` |

Sonderfall: `customer.subscription.deleted` setzt weiterhin explizit den eigenständigen lokalen
Status `canceled` (nicht über die obige Tabelle) – unverändert gegenüber dem bisherigen Verhalten.

**Offene Produktentscheidung:** Ob `trialing` einen eigenen lokalen Status verdienen würde (statt
in `inactive` zu landen), ist eine Produktfrage, die diese Phase nicht beantwortet – es gibt
aktuell keine Trial-Phase im Produkt, das Feld ist rein vorsorglich in Stripes API vorhanden.

## 4. Stripe Event Idempotency (Teil B/C)

Neue Tabelle `stripe_webhook_events` (Migration 0011): `stripe_event_id UNIQUE`. Jeder Webhook-
Request versucht zuerst einen atomaren Claim:

```sql
INSERT INTO stripe_webhook_events (stripe_event_id, event_type, stripe_created_at, status)
VALUES ($1, $2, to_timestamp($3), 'processing')
ON CONFLICT (stripe_event_id) DO NOTHING
RETURNING id
```

Gewinnt der Request (eine Zeile zurück), verarbeitet er das Event. Verliert er (0 Zeilen), prüft
er den vorhandenen Status:
- `processed` → idempotent erfolgreich beenden, keine erneute Verarbeitung.
- `processing` → ein paralleler Request verarbeitet das Event bereits, idempotent erfolgreich
  beenden.
- `failed` → Reclaim-Versuch (`UPDATE ... WHERE status = 'failed'`), damit Stripes automatischer
  Retry eines zuvor gescheiterten Events erneut verarbeitet werden kann.

Dies ist eine **echte DB-Garantie** (UNIQUE-Constraint + atomarer `ON CONFLICT`), keine reine
JS-seitige "already processed"-Prüfung – verifiziert gegen echtes PostgreSQL mit zwei parallelen
`psql`-Sessions (siehe Abschnitt 14).

## 5. Event Ordering (Teil D)

Neue Spalte `users.subscription_state_updated_at`. Jede Schreiboperation, die
`subscription_status`/`subscription_tier`/`subscription_cancel_at` aus einem Stripe-Event heraus
setzt, tut dies über eine der drei Ordering-Guard-Funktionen in
`src/lib/billing/subscription-state.ts` (`applyCheckoutActivation`, `applySubscriptionUpdated`,
`applySubscriptionDeleted`):

```sql
UPDATE users SET ..., subscription_state_updated_at = $eventCreatedAt
WHERE id = $userId
  AND (subscription_state_updated_at IS NULL OR subscription_state_updated_at < $eventCreatedAt)
```

`$eventCreatedAt` ist immer `event.created` (Stripe Event Creation Time), **nie** `received_at`
oder `now()` des Webhooks. Ein älteres Event kann einen bereits angewendeten neueren Zustand
dadurch nie überschreiben, unabhängig von der Empfangsreihenfolge – verifiziert gegen echtes
PostgreSQL (Abschnitt 14) und über 5 Vitest-Szenarien (Teil Q) in
`tests/routes/billing-webhook.test.ts`.

Direkte, nutzerausgelöste Aktionen außerhalb des Webhooks (Tarifwechsel in
`/api/billing/checkout`, Admin-Kündigung in `/api/admin/users/[id]/cancel-subscription`) stempeln
`subscription_state_updated_at = now()`, damit ein noch ausstehender, älterer Webhook diese
bewusste, sofortige Aktion nicht rückgängig macht.

## 6. Payment Failed Verhalten (Teil F)

`invoice.payment_failed` bedeutet **nicht** automatisch eine Kündigung. Stripe unternimmt bei
fehlgeschlagenen Zahlungen i.d.R. weitere Zahlungsversuche und setzt die Subscription währenddessen
auf `past_due`. Die Verarbeitung ruft daher die betroffene Subscription live bei Stripe ab
(`stripe.subscriptions.retrieve()`) und wendet ihren **tatsächlichen, autoritativen Status** über
dieselbe Logik wie `customer.subscription.updated` an. Eine aktive Subscription, die Stripe
weiterhin als `active` führt (z.B. weil eine Karte im Hintergrund erneut belastet wurde), bleibt
lokal `active`. Erst wenn Stripe selbst den Status ändert (`past_due`, später ggf. `canceled` nach
Ausschöpfen aller Versuche), spiegelt sich das lokal wider.

Keine Subscription auf der Invoice referenziert, oder die Subscription bei Stripe nicht mehr
auffindbar → kein Fehler, Event wird als verarbeitet markiert (nichts Fachliches nachzuvollziehen).

## 7. Reconciliation (Teil J/L)

`reconcileUserStripeSubscription(userId)` (`src/lib/billing/reconcile-subscription.ts`):
1. Lädt `stripe_customer_id` des Nutzers. Fehlt er → `no_customer`.
2. Ruft `stripe.subscriptions.list({ customer, status: 'all' })` ab.
3. Keine Subscription → lokal `inactive` gesetzt, `no_subscription`.
4. Mehrere Subscriptions (architektonisch nicht vorgesehen, aber möglich bei manueller
   Dashboard-Aktion) → bevorzugt eine aktive, sonst die zuletzt erstellte (dokumentierte,
   deterministische Auswahl, keine neue Produktentscheidung).
5. Wendet den gefundenen Zustand über `applySubscriptionUpdated()` an, mit `eventCreatedAt = new
   Date()` – live abgerufene Daten sind per Definition aktueller als jedes gespeicherte
   Webhook-Event und gewinnen daher immer gegen den Ordering-Guard.
6. Stripe-API-Fehler (z.B. unbekannter Customer, Rate-Limit) → lokaler Zustand bleibt
   **unverändert**, `error` wird zurückgegeben.

**Keine automatische Massen-Reconciliation** in dieser Phase (kein Cron). Aktuell einziger
Aufrufer: der Checkout-Fallback in `dashboard/abo/page.tsx` (Abschnitt 8). Die Funktion ist
bewusst so gebaut, dass sie später von einem Cron/Admin-Endpoint wiederverwendet werden kann.
**Nicht öffentlich/unauthentifiziert erreichbar**: kein eigener API-Endpoint, ausschließlich
Server-seitiger Funktionsaufruf aus bereits authentifiziertem Kontext.

## 8. Checkout-Fallback (Teil K)

`dashboard/abo/page.tsx`: kehrt der Nutzer mit `?success=1` vom Stripe-Checkout zurück und zeigt
die lokale DB noch **kein** aktives Abo, wird `reconcileUserStripeSubscription()` **genau einmal**
aufgerufen, bevor die Seite rendert. Kein blindes Warten, keine ungeprüfte UI-Aktivierung – Stripe
wird gezielt live gefragt. War der Webhook zu diesem Zeitpunkt bereits durchgelaufen, ist der
Aufruf ein No-op (derselbe, bereits aktive Zustand wird erneut geschrieben).

## 9. Fehler-/Retry-Verhalten (Teil O)

```
INSERT (Claim, status='processing')
  → fachliche Verarbeitung
    → Erfolg: UPDATE status='processed', processed_at=now()
    → Fehler: UPDATE status='failed', error_message=<gekürzte Meldung>, HTTP 500
```

Ein HTTP-500 signalisiert Stripe, das Event erneut zuzustellen. Ein zuvor `failed`-markiertes
Event kann über den Reclaim-Mechanismus (Abschnitt 4) erneut verarbeitet werden. Ein bereits
`processed`-Event führt bei jeder weiteren Zustellung zu keiner erneuten Nebenwirkung (keine
doppelte Aktivierung, keine doppelte E-Mail/Analytics-Aktion – diese Phase fügt ohnehin keine
E-Mail/Analytics-Nebenwirkung zum Webhook hinzu, siehe Abschnitt 10).

## 10. Offene Produktentscheidungen

- Ob bei `invoice.payment_failed` künftig eine Benachrichtigungs-E-Mail an den Unternehmer
  versendet werden soll, ist eine Produktentscheidung, die diese Phase nicht trifft (kein
  bestehender E-Mail-Baustein dafür, keiner wurde erfunden).
- Ob `trialing` einen eigenen lokalen Status bekommen soll (Abschnitt 3).
- Eine automatische, periodische Massen-Reconciliation (Cron) ist vorbereitet (die Funktion
  existiert und ist wiederverwendbar), aber nicht Teil dieser Phase.

## Sicherheit (Teil M)

- Signature-Verifikation unverändert: `stripe.webhooks.constructEvent(rawBody, signature,
  webhookSecret)` mit dem rohen Body (`req.text()`), keine JSON-Rekonstruktion davor.
- Fehlendes `stripe-signature`-Header oder fehlendes `STRIPE_WEBHOOK_SECRET` → 500, keine
  Verarbeitung.
- Ungültige Signatur → 400, keine Verarbeitung.
- `STRIPE_SECRET_KEY` darf in Production nicht mehr still auf einen Platzhalter zurückfallen
  (`src/lib/stripe.ts`, Teil Y) – analog zum bestehenden `NEXT_PUBLIC_APP_URL`-Muster in
  `src/lib/url.ts`. Der Platzhalter bleibt für Entwicklung/Build/Tests bestehen.

## Datenschutz (Teil W)

`stripe_webhook_events` speichert **keine** vollständigen Stripe-Payloads, keine Payment-/
Kundendaten – nur `stripe_event_id`, `event_type`, Zeitstempel, `status` und im Fehlerfall eine auf
500 Zeichen gekürzte technische Fehlermeldung (nie Secrets, nie vollständige Payloads).

## Performance (Teil V)

Der Webhook nutzt primär die im Event mitgelieferten Daten. Ein zusätzlicher Stripe-API-Aufruf
(`subscriptions.retrieve`) erfolgt ausschließlich bei `invoice.payment_failed`, wo der autoritative
aktuelle Subscription-Status auf der Invoice selbst nicht zuverlässig verfügbar ist. Kein N+1: pro
Event höchstens ein zusätzlicher Stripe-Aufruf. Die Reconciliation macht genau einen
`subscriptions.list`-Aufruf pro Aufruf.

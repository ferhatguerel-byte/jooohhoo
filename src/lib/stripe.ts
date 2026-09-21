import Stripe from 'stripe'

let stripeClient: Stripe | undefined

/**
 * Phase 4.2 (Teil Y) – `STRIPE_SECRET_KEY` darf in Production nicht still auf einen
 * Platzhalter zurückfallen (sonst würden Stripe-Aufrufe erst mit einem verwirrenden
 * Auth-Fehler von Stripe selbst scheitern, statt mit einer klaren eigenen Fehlermeldung).
 * Der Platzhalter bleibt für Entwicklung/Build/Tests bestehen (z.B. `next build` evaluiert
 * Module ohne echte Secrets), analog zum bestehenden Muster in `src/lib/url.ts` für
 * `NEXT_PUBLIC_APP_URL`. Nur der Stripe-relevante Fallback wird hier gehärtet – das übrige,
 * bereits im Audit gefundene generelle Environment-Hardening ist nicht Teil dieser Phase.
 */
export function getStripe(): Stripe {
  if (!stripeClient) {
    const secretKey = process.env.STRIPE_SECRET_KEY
    if (!secretKey && process.env.NODE_ENV === 'production') {
      throw new Error(
        'STRIPE_SECRET_KEY ist nicht gesetzt. In Production darf hierfür kein Platzhalter-Fallback ' +
          'verwendet werden. Bitte die Umgebungsvariable in den Vercel-Projekteinstellungen setzen.'
      )
    }
    stripeClient = new Stripe(secretKey || 'sk_test_build_placeholder')
  }
  return stripeClient
}

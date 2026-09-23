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
    // Fail-fast statt eines erst beim tatsächlichen API-Call auftretenden, schwer zu diagnostizierenden
    // Stripe-Fehlers ("This API call cannot be made with a publishable API key"): STRIPE_SECRET_KEY
    // muss ein Secret Key (sk_...) sein, niemals ein Publishable Key (pk_...) – dieser gehört
    // ausschließlich in clientseitigen Code, den dieses Projekt bewusst nicht verwendet (Hosted
    // Checkout/Billing Portal statt @stripe/stripe-js/Elements, siehe docs/phase-4.1-security-hardening.md).
    if (secretKey?.startsWith('pk_')) {
      throw new Error(
        'STRIPE_SECRET_KEY enthält einen Publishable Key (pk_...) statt eines Secret Keys (sk_...). ' +
          'Bitte den Wert in den Vercel-Projekteinstellungen durch den Secret Key ersetzen: ' +
          'https://dashboard.stripe.com/account/api-keys'
      )
    }
    stripeClient = new Stripe(secretKey || 'sk_test_build_placeholder')
  }
  return stripeClient
}

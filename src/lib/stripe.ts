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
    // Phase 2G.17 – bewusst an `VERCEL_ENV` gekoppelt, NICHT an `NODE_ENV`: Next.js baut sowohl
    // Vercel-Production- als auch Preview-Deployments mit `NODE_ENV=production` (siehe
    // Phase-2G.16-Audit), nur `VERCEL_ENV` unterscheidet die beiden. Ein Preview-Deployment MUSS
    // weiterhin einen Test-Key verwenden können – diese Prüfung darf das nicht verhindern, sie
    // gilt ausschließlich für das tatsächliche Vercel-Production-Environment. Lokale Entwicklung
    // (VERCEL_ENV ist dort nicht gesetzt) ist ebenfalls nicht betroffen.
    //
    // Ohne diese Prüfung akzeptierte getStripe() in Production bisher auch einen gültig
    // aussehenden, aber im Testmodus laufenden Schlüssel (sk_test_...) anstandslos – das führte
    // zu genau der in der Produktion beobachteten Diskrepanz (Stripe-Objekte, die im Live-Konto
    // nicht auffindbar sind, "No such subscription" bei einer Admin-Kündigung).
    if (process.env.VERCEL_ENV === 'production' && !secretKey?.startsWith('sk_live_')) {
      throw new Error(
        'STRIPE_SECRET_KEY ist in der Vercel-Production-Umgebung kein Live-Schlüssel (sk_live_...) – ' +
          'der Wert fehlt oder beginnt mit einem anderen Präfix (z.B. sk_test_...). Ein Test-Schlüssel ' +
          'darf in Production niemals verwendet werden. Bitte den Live Secret Key in den ' +
          'Vercel-Projekteinstellungen (Environment: Production) hinterlegen: https://dashboard.stripe.com/apikeys'
      )
    }
    stripeClient = new Stripe(secretKey || 'sk_test_build_placeholder')
  }
  return stripeClient
}

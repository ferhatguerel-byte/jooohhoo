import { NextRequest, NextResponse } from 'next/server'
import { requireAuthenticatedUserApi } from '@/lib/authorization'
import { getStripe } from '@/lib/stripe'
import { getAppUrl } from '@/lib/url'
import { getLockedPortalConfigurationId } from '@/lib/stripe-portal'
import { handleApiError } from '@/lib/api-error'

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuthenticatedUserApi()
    if (!user.stripeCustomerId) {
      return NextResponse.json({ error: 'Kein Abo vorhanden.' }, { status: 404 })
    }

    const appUrl = getAppUrl(req)
    const stripe = getStripe()

    // Beim Jahrespaket läuft die Kündigung immer über unseren eigenen "Vertrag kündigen"-Flow
    // (Mindestlaufzeit + 3 Monate Kündigungsfrist) statt über Stripes generischen Kündigen-Button.
    const restrictedConfig = user.subscriptionTier === 'yearly' ? await getLockedPortalConfigurationId(stripe) : undefined

    // customer stammt ausschließlich aus dem eigenen, serverseitig geladenen Nutzerdatensatz –
    // ein Client kann hier keine fremde Stripe-Customer-ID erzwingen.
    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${appUrl}/dashboard/einstellungen/mitgliedschaft`,
      ...(restrictedConfig ? { configuration: restrictedConfig } : {}),
    })

    return NextResponse.json({ url: session.url })
  } catch (err: unknown) {
    return handleApiError(err, 'Kundenportal konnte nicht geöffnet werden.')
  }
}

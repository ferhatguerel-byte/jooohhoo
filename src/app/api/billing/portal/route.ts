import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/current-user'
import { getStripe } from '@/lib/stripe'
import { getAppUrl } from '@/lib/url'
import { getLockedPortalConfigurationId } from '@/lib/stripe-portal'

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user || !user.stripeCustomerId) {
    return NextResponse.json({ error: 'Kein Abo vorhanden.' }, { status: 404 })
  }

  const appUrl = getAppUrl(req)
  const stripe = getStripe()

  // Beim Jahrespaket läuft die Kündigung immer über unseren eigenen "Vertrag kündigen"-Flow
  // (Mindestlaufzeit + 3 Monate Kündigungsfrist) statt über Stripes generischen Kündigen-Button.
  const restrictedConfig = user.subscriptionTier === 'yearly' ? await getLockedPortalConfigurationId(stripe) : undefined

  const session = await stripe.billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: `${appUrl}/dashboard/einstellungen/mitgliedschaft`,
    ...(restrictedConfig ? { configuration: restrictedConfig } : {}),
  })

  return NextResponse.json({ url: session.url })
}

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireActiveUserApi } from '@/lib/authorization'
import { getStripe } from '@/lib/stripe'
import { TIER_ORDER } from '@/lib/tiers'
import { createTierChangePreview } from '@/lib/billing/tier-change-preview'
import { handleApiError } from '@/lib/api-error'

const previewSchema = z.object({ tier: z.enum(TIER_ORDER as [string, ...string[]]) })

/**
 * Phase 2B (Aufgabe 3) – reine Preisvorschau für einen Tarifwechsel, OHNE jede Ausführung
 * (kein stripe.subscriptions.update). Dieselben Rollen-/Downgrade-Sperren wie im bestehenden
 * Checkout (Zeile 97-105 in checkout/route.ts) gelten auch hier, damit eine Vorschau nie für
 * einen gar nicht zulässigen Wechsel erzeugt wird.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireActiveUserApi()
    if (user.role !== 'subunternehmer') {
      return NextResponse.json({ error: 'Nur Unternehmer können ein Abo wechseln.' }, { status: 403 })
    }
    const { tier } = previewSchema.parse(await req.json())

    const hasActiveSub = user.subscriptionStatus === 'active' && !!user.subscriptionTier && !!user.stripeSubscriptionId
    if (!hasActiveSub) {
      return NextResponse.json({ error: 'Kein aktives Abo vorhanden.' }, { status: 409 })
    }
    if (user.subscriptionTier === tier) {
      return NextResponse.json({ error: 'Sie haben dieses Abo bereits aktiv.' }, { status: 409 })
    }
    if (user.subscriptionTier === 'yearly' && tier === 'monthly') {
      return NextResponse.json(
        {
          error:
            'Ein Wechsel vom Jahrespaket zum Monatspaket ist während der laufenden 12-Monats-Laufzeit nicht möglich. Bitte kündigen Sie zunächst über "Vertrag kündigen".',
        },
        { status: 409 }
      )
    }

    const stripe = getStripe()
    const preview = await createTierChangePreview(stripe, user, tier as (typeof TIER_ORDER)[number])

    return NextResponse.json(preview)
  } catch (err: unknown) {
    return handleApiError(err, 'Preisvorschau konnte nicht berechnet werden.')
  }
}

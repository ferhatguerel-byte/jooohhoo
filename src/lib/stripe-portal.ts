import type Stripe from 'stripe'
import { getDb } from '@/lib/db'
import { getAppUrl } from '@/lib/url'

const SETTING_KEY = 'stripe_portal_config_locked'

/**
 * Liefert die ID einer Stripe-Kundenportal-Konfiguration, in der "Abo kündigen" deaktiviert ist.
 * Wird einmalig automatisch angelegt (unabhängig von einer eventuell fehlenden Standard-
 * Konfiguration im Stripe-Account) und danach in der Datenbank zwischengespeichert.
 * Ein manuell gesetztes STRIPE_PORTAL_CONFIGURATION_ID_LOCKED hat weiterhin Vorrang.
 */
export async function getLockedPortalConfigurationId(stripe: Stripe): Promise<string | undefined> {
  if (process.env.STRIPE_PORTAL_CONFIGURATION_ID_LOCKED) {
    return process.env.STRIPE_PORTAL_CONFIGURATION_ID_LOCKED
  }

  const db = getDb()
  const cached = await db.query('SELECT value FROM app_settings WHERE key = $1', [SETTING_KEY])
  if (cached.rows.length > 0) {
    return cached.rows[0].value
  }

  try {
    const appUrl = getAppUrl()
    const created = await stripe.billingPortal.configurations.create({
      business_profile: {
        headline: 'BAUVERSUS',
        privacy_policy_url: `${appUrl}/datenschutz`,
        terms_of_service_url: `${appUrl}/agb`,
      },
      features: {
        customer_update: { enabled: true, allowed_updates: ['email', 'address', 'phone', 'tax_id'] },
        invoice_history: { enabled: true },
        payment_method_update: { enabled: true },
        subscription_update: { enabled: false, default_allowed_updates: [], products: [] },
        subscription_cancel: { enabled: false },
      },
    })

    await db.query(
      `INSERT INTO app_settings (key, value) VALUES ($1, $2)
       ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = now()`,
      [SETTING_KEY, created.id]
    )

    return created.id
  } catch (err) {
    console.error('Portal-Konfiguration konnte nicht erstellt werden:', err instanceof Error ? err.message : err)
    return undefined
  }
}

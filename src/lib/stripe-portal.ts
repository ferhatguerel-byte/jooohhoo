import type Stripe from 'stripe'
import { getDb } from '@/lib/db'

const SETTING_KEY = 'stripe_portal_config_locked'

/**
 * Liefert die ID einer Stripe-Kundenportal-Konfiguration, in der "Abo kündigen" deaktiviert ist.
 * Wird einmalig automatisch angelegt (auf Basis der Standard-Konfiguration) und danach in der
 * Datenbank zwischengespeichert, damit nicht bei jedem Aufruf eine neue Konfiguration entsteht.
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
    const defaults = await stripe.billingPortal.configurations.list({ is_default: true, limit: 1 })
    const base = defaults.data[0]
    if (!base) return undefined

    const created = await stripe.billingPortal.configurations.create({
      business_profile: {
        headline: base.business_profile.headline ?? undefined,
        privacy_policy_url: base.business_profile.privacy_policy_url ?? undefined,
        terms_of_service_url: base.business_profile.terms_of_service_url ?? undefined,
      },
      features: {
        customer_update: {
          enabled: base.features.customer_update.enabled,
          allowed_updates: base.features.customer_update.allowed_updates,
        },
        invoice_history: { enabled: base.features.invoice_history.enabled },
        payment_method_update: { enabled: base.features.payment_method_update.enabled },
        subscription_update: {
          enabled: false,
          default_allowed_updates: [],
          products: [],
        },
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

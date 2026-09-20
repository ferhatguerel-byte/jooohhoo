import { cache } from 'react'
import { getSession } from '@/lib/auth'
import { getDb } from '@/lib/db'
import type { TierId } from '@/lib/tiers'

export interface CurrentUser {
  id: string
  email: string
  role: 'auftraggeber' | 'subunternehmer'
  companyName: string
  phone: string | null
  plz: string
  ort: string
  gewerke: string[]
  subscriptionTier: TierId | null
  subscriptionStatus: 'inactive' | 'active' | 'canceled' | 'past_due'
  stripeCustomerId: string | null
  stripeSubscriptionId: string | null
  verificationStatus: 'unverified' | 'pending' | 'verified' | 'rejected'
  qualificationFiles: { fileId: string; name: string; label: string }[]
  emailNotifications: boolean
  newsletterOptIn: boolean
  subscriptionCommittedUntil: string | null
  subscriptionCancelAt: string | null
  accountStatus: 'active' | 'suspended'
  blockedGewerke: string[]
  directoryListed: boolean
  verifiedGewerke: string[]
}

/**
 * Über React.cache() pro Request memoisiert: mehrere Aufrufe innerhalb desselben
 * Server-Component-Rendertrees (z. B. im Layout und in der Page) lösen nur eine
 * DB-Abfrage aus statt einer pro Aufruf. Der Cache wird von Next.js für jeden neuen
 * Request zurückgesetzt, es werden also nie Daten zwischen Nutzern/Requests geteilt.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await getSession()
  if (!session) return null

  const db = getDb()
  const result = await db.query(
    `SELECT id, email, role, company_name, phone, plz, ort, gewerke,
            subscription_tier, subscription_status, stripe_customer_id, stripe_subscription_id,
            verification_status, qualification_files, email_notifications, newsletter_opt_in,
            subscription_committed_until, subscription_cancel_at, account_status, blocked_gewerke,
            directory_listed, verified_gewerke
     FROM users WHERE id = $1`,
    [session.userId]
  )
  const row = result.rows[0]
  if (!row) return null

  return {
    id: row.id,
    email: row.email,
    role: row.role,
    companyName: row.company_name,
    phone: row.phone,
    plz: row.plz,
    ort: row.ort,
    gewerke: row.gewerke || [],
    subscriptionTier: row.subscription_tier,
    subscriptionStatus: row.subscription_status,
    stripeCustomerId: row.stripe_customer_id,
    stripeSubscriptionId: row.stripe_subscription_id,
    verificationStatus: row.verification_status,
    qualificationFiles: row.qualification_files || [],
    emailNotifications: row.email_notifications,
    newsletterOptIn: row.newsletter_opt_in,
    subscriptionCommittedUntil: row.subscription_committed_until,
    subscriptionCancelAt: row.subscription_cancel_at,
    accountStatus: row.account_status,
    blockedGewerke: row.blocked_gewerke || [],
    directoryListed: row.directory_listed,
    verifiedGewerke: row.verified_gewerke || [],
  }
})

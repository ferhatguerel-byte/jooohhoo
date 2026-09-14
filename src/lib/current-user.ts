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
  qualificationFiles: { url: string; name: string; label: string }[]
  emailNotifications: boolean
  newsletterOptIn: boolean
  subscriptionCommittedUntil: string | null
  subscriptionCancelAt: string | null
  accountStatus: 'active' | 'suspended'
  blockedGewerke: string[]
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await getSession()
  if (!session) return null

  const db = getDb()
  const result = await db.query(
    `SELECT id, email, role, company_name, phone, plz, ort, gewerke,
            subscription_tier, subscription_status, stripe_customer_id, stripe_subscription_id,
            verification_status, qualification_files, email_notifications, newsletter_opt_in,
            subscription_committed_until, subscription_cancel_at, account_status, blocked_gewerke
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
  }
}

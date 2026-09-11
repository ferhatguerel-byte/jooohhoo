import { getSession } from '@/lib/auth'
import { getDb } from '@/lib/db'

export interface CurrentUser {
  id: string
  email: string
  role: 'auftraggeber' | 'subunternehmer'
  companyName: string
  phone: string | null
  plz: string
  ort: string
  gewerke: string[]
  subscriptionTier: 'basic' | 'pro' | 'premium' | null
  subscriptionStatus: 'inactive' | 'active' | 'canceled' | 'past_due'
  stripeCustomerId: string | null
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await getSession()
  if (!session) return null

  const db = getDb()
  const result = await db.query(
    `SELECT id, email, role, company_name, phone, plz, ort, gewerke,
            subscription_tier, subscription_status, stripe_customer_id
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
  }
}

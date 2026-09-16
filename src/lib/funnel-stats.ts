import { getDb } from '@/lib/db'

export interface FunnelStats {
  unternehmer: {
    registered: number
    verified: number
    activeSubscription: number
  }
  auftraege: {
    posted: number
    withOffer: number
    awarded: number
  }
}

export async function getFunnelStats(): Promise<FunnelStats> {
  const db = getDb()

  const [registered, verified, activeSubscription, posted, withOffer, awarded] = await Promise.all([
    db.query(`SELECT COUNT(*)::int AS count FROM users WHERE role = 'subunternehmer'`),
    db.query(`SELECT COUNT(*)::int AS count FROM users WHERE role = 'subunternehmer' AND verification_status = 'verified'`),
    db.query(`SELECT COUNT(*)::int AS count FROM users WHERE role = 'subunternehmer' AND subscription_status = 'active'`),
    db.query(`SELECT COUNT(*)::int AS count FROM jobs`),
    db.query(`SELECT COUNT(DISTINCT job_id)::int AS count FROM offers`),
    db.query(`SELECT COUNT(*)::int AS count FROM jobs WHERE awarded_subunternehmer_id IS NOT NULL`),
  ])

  return {
    unternehmer: {
      registered: registered.rows[0].count,
      verified: verified.rows[0].count,
      activeSubscription: activeSubscription.rows[0].count,
    },
    auftraege: {
      posted: posted.rows[0].count,
      withOffer: withOffer.rows[0].count,
      awarded: awarded.rows[0].count,
    },
  }
}

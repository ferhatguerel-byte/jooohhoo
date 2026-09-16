import { getDb } from '@/lib/db'

export interface RegionalPriceStats {
  avgPrice: number
  minPrice: number
  maxPrice: number
  sampleSize: number
  regionLabel: string
}

/**
 * Regionaler Preisvergleich: Durchschnitt/Spanne tatsächlich vergebener (angenommener)
 * Angebote für dasselbe Gewerk in derselben PLZ-Region (erste 2 Ziffern der PLZ).
 * Nur Stichproben ab 3 Aufträgen werden gezeigt, um Rückschlüsse auf Einzelangebote
 * auszuschließen und die Aussagekraft zu sichern.
 */
export async function getRegionalPriceStats(gewerk: string, plz: string): Promise<RegionalPriceStats | null> {
  if (!plz || plz.length < 2) return null
  const regionPrefix = plz.slice(0, 2)
  const db = getDb()

  const result = await db.query(
    `SELECT AVG(o.price)::int AS avg_price, MIN(o.price)::int AS min_price, MAX(o.price)::int AS max_price,
            COUNT(*)::int AS sample_size
     FROM offers o
     JOIN jobs j ON j.id = o.job_id
     WHERE o.status = 'accepted' AND j.gewerk = $1 AND j.plz LIKE $2
       AND o.created_at > now() - interval '18 months'`,
    [gewerk, `${regionPrefix}%`]
  )

  const row = result.rows[0]
  if (!row || row.sample_size < 3) return null

  return {
    avgPrice: row.avg_price,
    minPrice: row.min_price,
    maxPrice: row.max_price,
    sampleSize: row.sample_size,
    regionLabel: `PLZ-Gebiet ${regionPrefix}xxx`,
  }
}

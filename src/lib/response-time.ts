import { getDb } from '@/lib/db'

export interface ResponseTimeStats {
  avgHours: number
  sampleSize: number
  label: string
}

/**
 * Durchschnittliche Reaktionszeit eines Unternehmers: Zeit zwischen einer Nachricht des
 * Auftraggebers und der nächsten Antwort des Unternehmers im selben Angebots-Chat.
 * Nur die letzten 90 Tage zählen, damit die Angabe aktuell bleibt.
 */
export async function getResponseTimeStats(subunternehmerId: string): Promise<ResponseTimeStats | null> {
  const db = getDb()

  const result = await db.query(
    `SELECT AVG(EXTRACT(EPOCH FROM (reply.created_at - incoming.created_at)) / 3600.0) AS avg_hours,
            COUNT(*)::int AS sample_size
     FROM offer_messages incoming
     JOIN offers o ON o.id = incoming.offer_id
     JOIN LATERAL (
       SELECT created_at FROM offer_messages reply
       WHERE reply.offer_id = incoming.offer_id
         AND reply.sender_id = o.subunternehmer_id
         AND reply.created_at > incoming.created_at
       ORDER BY reply.created_at ASC LIMIT 1
     ) reply ON true
     WHERE o.subunternehmer_id = $1
       AND incoming.sender_id != o.subunternehmer_id
       AND incoming.created_at > now() - interval '90 days'`,
    [subunternehmerId]
  )

  const row = result.rows[0]
  if (!row || row.sample_size < 3) return null

  const avgHours = Number(row.avg_hours)
  let label: string
  if (avgHours < 1) label = 'unter 1 Stunde'
  else if (avgHours < 4) label = 'unter 4 Stunden'
  else if (avgHours < 24) label = 'unter 24 Stunden'
  else label = 'über 1 Tag'

  return { avgHours, sampleSize: row.sample_size, label }
}

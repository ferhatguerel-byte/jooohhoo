export interface Queryable {
  query(text: string, params?: unknown[]): Promise<{ rowCount: number | null; rows: unknown[] }>
}

export type ClaimResult =
  | { claimed: true }
  | { claimed: false; reason: 'already_processed' | 'in_progress' }

/**
 * Phase 4.2 (Teil B/C) – DB-seitig garantierte Idempotenz für Stripe-Webhook-Events, gestützt auf
 * `stripe_webhook_events.stripe_event_id UNIQUE` (Migration 0011). KEINE reine
 * "if already processed"-Prüfung in JS: der `INSERT ... ON CONFLICT DO NOTHING` ist atomar –
 * schickt Stripe dasselbe Event zweimal nahezu gleichzeitig, gewinnt genau einer der beiden
 * `INSERT`-Aufrufe die Zeile (RETURNING liefert eine Zeile), der andere bekommt 0 Zeilen zurück
 * und nimmt den "bereits vorhanden"-Pfad – real auf PostgreSQL-Ebene erzwungen, keine
 * Race Condition zwischen zwei Node-Prozessen/Requests möglich.
 *
 * Ein zuvor `failed`-markiertes Event darf erneut geclaimt werden (Stripe wiederholt einen
 * Webhook automatisch, wenn die Antwort nicht 2xx war) – auch dieser Reclaim ist über die
 * WHERE-Bedingung im UPDATE atomar: gewinnt bei gleichzeitigem Reclaim nur einer der beiden
 * Prozesse.
 */
export async function claimStripeEvent(
  db: Queryable,
  eventId: string,
  eventType: string,
  createdAtUnixSeconds: number
): Promise<ClaimResult> {
  const insert = await db.query(
    `INSERT INTO stripe_webhook_events (stripe_event_id, event_type, stripe_created_at, status)
     VALUES ($1, $2, to_timestamp($3), 'processing')
     ON CONFLICT (stripe_event_id) DO NOTHING
     RETURNING id`,
    [eventId, eventType, createdAtUnixSeconds]
  )
  if ((insert.rowCount ?? 0) > 0) return { claimed: true }

  const existing = await db.query('SELECT status FROM stripe_webhook_events WHERE stripe_event_id = $1', [eventId])
  const status = (existing.rows[0] as { status?: string } | undefined)?.status

  if (status === 'failed') {
    const retryClaim = await db.query(
      `UPDATE stripe_webhook_events SET status = 'processing' WHERE stripe_event_id = $1 AND status = 'failed' RETURNING id`,
      [eventId]
    )
    if ((retryClaim.rowCount ?? 0) > 0) return { claimed: true }
    // Ein paralleler zweiter Retry-Versuch hat den Reclaim gerade gewonnen -> dieser Request
    // beendet sich idempotent erfolgreich, ohne die Verarbeitung zu wiederholen.
    return { claimed: false, reason: 'in_progress' }
  }
  if (status === 'processed') return { claimed: false, reason: 'already_processed' }
  // 'processing' (paralleler Request gerade dabei) oder – im höchst unwahrscheinlichen Fall einer
  // Race direkt nach dem Insert-Konflikt – noch nicht lesbar: sicherer Default, kein Doppel-Effekt.
  return { claimed: false, reason: 'in_progress' }
}

export async function markStripeEventProcessed(db: Queryable, eventId: string): Promise<void> {
  await db.query(
    `UPDATE stripe_webhook_events SET status = 'processed', processed_at = now(), error_message = NULL WHERE stripe_event_id = $1`,
    [eventId]
  )
}

/** Fehlermeldung wird gekürzt und darf nie Stripe-Secrets/vollständige Payloads enthalten
 * (Teil W, Datenschutz) – Aufrufer übergeben ausschließlich `err.message`. */
export async function markStripeEventFailed(db: Queryable, eventId: string, message: string): Promise<void> {
  await db.query(`UPDATE stripe_webhook_events SET status = 'failed', error_message = $2 WHERE stripe_event_id = $1`, [
    eventId,
    message.slice(0, 500),
  ])
}

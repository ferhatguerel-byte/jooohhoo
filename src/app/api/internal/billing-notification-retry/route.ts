import { timingSafeEqual } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { runBillingNotificationRetryBatch } from '@/lib/billing/retry-billing-notifications'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'
import { logEvent } from '@/lib/observability/logger'
import { getRequestId } from '@/lib/observability/request-id'

/**
 * Phase 2B – interner Endpunkt für den periodischen Retry der Abo-Bestätigungs-Outbox. Struktur
 * 1:1 identisch zu /api/internal/match-email-retry (Phase 3.6F/4.3) – gleiches Secret-Muster,
 * gleiche Rate-Limits, eigener Endpunkt statt den bestehenden Match-E-Mail-Cron zu erweitern (der
 * darf gemäß Vorgabe nicht regressiv verändert werden). Muss wie der bestehende Cron-Endpunkt von
 * einem externen Scheduler (siehe docs/cron-external-scheduler.md) periodisch aufgerufen werden –
 * ohne das ist diese Route in Production inaktiv (kein Vercel-Hobby-Cron, s. bekannte Einschränkung).
 */
function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false

  const header = req.headers.get('authorization') || ''
  const expected = `Bearer ${secret}`
  const headerBuf = Buffer.from(header)
  const expectedBuf = Buffer.from(expected)
  if (headerBuf.length !== expectedBuf.length) return false
  return timingSafeEqual(headerBuf, expectedBuf)
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    await checkRateLimit('cron-billing-notification-retry-authfail', getClientIp(req), 20, 10).catch(() => {})
    return NextResponse.json({ error: 'Nicht autorisiert.' }, { status: 401 })
  }

  const withinBudget = await checkRateLimit('cron-billing-notification-retry', 'global', 20, 60)
  if (!withinBudget) {
    return NextResponse.json({ error: 'Rate-Limit für diesen internen Endpunkt erreicht.' }, { status: 429 })
  }

  const requestId = getRequestId(req)

  try {
    const result = await runBillingNotificationRetryBatch()

    logEvent('billing_notification_retry_batch_completed', 'info', {
      requestId,
      operation: 'billing_notification_retry',
      candidateCount: result.candidateCount,
      sent: result.outcomes.filter((o) => o.sent).length,
      notSent: result.outcomes.filter((o) => !o.sent).length,
    })

    return NextResponse.json({ ok: true, candidateCount: result.candidateCount })
  } catch (err) {
    logEvent('billing_notification_retry_batch_failed', 'error', { requestId, operation: 'billing_notification_retry' }, err)
    return NextResponse.json({ error: 'Batch-Verarbeitung fehlgeschlagen.' }, { status: 500 })
  }
}

import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { logEvent } from '@/lib/observability/logger'

/**
 * Phase 4.4 (Teil 10) – Health-/Readiness-Prüfung. Öffentlich, unauthentifiziert (Load-
 * Balancer/Uptime-Monitore haben typischerweise keine Session), bewusst leichtgewichtig: EIN
 * minimaler DB-Roundtrip (`SELECT 1`), keine teuren Aggregationen, keine geschäftlichen Daten.
 *
 * KEINE PII, KEINE Secrets, KEINE internen Details in der Antwort (Teil E/C) – nur ein boolescher
 * Gesamtzustand plus eine grobe Latenzangabe zur Diagnose (Teil 11).
 */
export async function GET() {
  const startedAt = Date.now()

  try {
    await getDb().query('SELECT 1')
    return NextResponse.json(
      { status: 'ok', db: 'ok', latencyMs: Date.now() - startedAt },
      { status: 200 }
    )
  } catch (err) {
    // Absichtlich keine Fehlermeldung/kein Stacktrace aus der DB-Exception in der Antwort – ein
    // öffentlicher Endpoint darf niemals interne Verbindungsdetails preisgeben. Die eigentliche
    // Diagnose läuft über das strukturierte Server-Log/Error-Tracking, nicht über diese Antwort.
    logEvent('health_check_db_failed', 'error', { operation: 'health_check' }, err)
    return NextResponse.json({ status: 'error', db: 'unreachable' }, { status: 503 })
  }
}

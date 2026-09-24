import type { NextRequest } from 'next/server'
import { getDb } from '@/lib/db'
import { getClientIp } from '@/lib/rate-limit'

/**
 * Bekannte Admin-Aktionen. Kein geschlossenes Enum in der DB (Spalte ist TEXT), damit neue
 * Aktionsarten ergänzt werden können, ohne eine Migration zu brauchen – dieser Union-Type
 * dient nur der Konsistenz/Auto-Vervollständigung an den Aufrufstellen.
 */
export type AdminAction =
  | 'USER_SUSPENDED'
  | 'USER_UNSUSPENDED'
  | 'USER_VERIFIED'
  | 'USER_UNVERIFIED'
  | 'DOCUMENT_APPROVED'
  | 'DOCUMENT_REJECTED'
  | 'GEWERK_BLOCKED'
  | 'GEWERK_UNBLOCKED'
  | 'SUBSCRIPTION_CHANGED'
  | 'WARNING_SENT'
  | 'NOTES_UPDATED'
  | 'GUIDE_ARTICLE_CREATED'
  | 'GUIDE_ARTICLE_UPDATED'
  | 'GUIDE_ARTICLE_DELETED'
  | 'SUPPORT_TICKET_STATUS_CHANGED'
  | 'SEO_STATUS_CHANGED'
  | 'PROVIDER_REMATCHED'

/**
 * Protokolliert eine sicherheitsrelevante Admin-Aktion in admin_audit_log.
 * Schlägt das Logging fehl, wird nur eine Warnung ausgegeben – die eigentliche Admin-Aktion
 * (die bereits ausgeführt wurde, bevor dies aufgerufen wird) darf dadurch nicht rückgängig
 * gemacht oder blockiert werden.
 */
export async function logAdminAction(
  adminId: string,
  action: AdminAction,
  targetType: string,
  targetId: string | null,
  metadata: Record<string, unknown> = {},
  req?: NextRequest
): Promise<void> {
  try {
    await getDb().query(
      `INSERT INTO admin_audit_log (admin_id, action, target_type, target_id, metadata, ip)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [adminId, action, targetType, targetId, JSON.stringify(metadata), req ? getClientIp(req) : null]
    )
  } catch (err) {
    console.error('Admin-Audit-Log fehlgeschlagen:', err instanceof Error ? err.message : err)
  }
}

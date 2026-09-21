import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdminApi } from '@/lib/authorization'
import { handleApiError } from '@/lib/api-error'
import { logAdminAction } from '@/lib/admin-audit'
import { getSeoLandingPageById, setAdminSeoStatus, clearAdminOverride, saveAdminNote } from '@/lib/seo/status'

const schema = z.object({
  status: z.enum(['DRAFT', 'REVIEW', 'INDEXABLE', 'NOINDEX']).optional(),
  adminNote: z.string().max(2000).optional(),
  resetToAuto: z.boolean().optional(),
})

/**
 * Einziger Schreibweg für den Status einer SEO-Landingpage. requireAdminApi() stellt serverseitig
 * sicher, dass nur der zentral konfigurierte Admin (siehe src/lib/authorization.ts) hierher
 * gelangt – es gibt keine zweite Admin-Prüfung. Jede Änderung wird auditiert.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const admin = await requireAdminApi()
    const body = schema.parse(await req.json())

    const page = await getSeoLandingPageById(id)
    if (!page) {
      return NextResponse.json({ error: 'SEO-Seite nicht gefunden.' }, { status: 404 })
    }

    if (body.resetToAuto) {
      await clearAdminOverride(page)
      await logAdminAction(admin.id, 'SEO_STATUS_CHANGED', 'seo_landing_page', id, { action: 'reset_to_auto' }, req)
    } else if (body.status) {
      await setAdminSeoStatus(page, body.status, body.adminNote)
      await logAdminAction(
        admin.id,
        'SEO_STATUS_CHANGED',
        'seo_landing_page',
        id,
        { action: 'set_status', from: page.status, to: body.status, pageType: page.pageType, gewerkSlug: page.gewerkSlug, citySlug: page.citySlug },
        req
      )
    } else if (typeof body.adminNote === 'string') {
      await saveAdminNote(page, body.adminNote)
      await logAdminAction(admin.id, 'SEO_STATUS_CHANGED', 'seo_landing_page', id, { action: 'note_updated' }, req)
    }

    const updated = await getSeoLandingPageById(id)
    return NextResponse.json({ ok: true, page: updated })
  } catch (err: unknown) {
    return handleApiError(err, 'SEO-Status konnte nicht geändert werden.')
  }
}

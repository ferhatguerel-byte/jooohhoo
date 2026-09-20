import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getDb } from '@/lib/db'
import { requireAdminApi } from '@/lib/authorization'
import { handleApiError } from '@/lib/api-error'
import { logAdminAction } from '@/lib/admin-audit'

const schema = z.object({
  userId: z.string().uuid(),
  status: z.enum(['verified', 'rejected', 'unverified']),
  verifiedGewerke: z.array(z.string()).optional(),
})

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdminApi()
    const { userId, status, verifiedGewerke } = schema.parse(await req.json())
    const newlyVerified = status === 'verified' ? verifiedGewerke || [] : []
    await getDb().query(
      `UPDATE users SET verification_status = $1, verified_gewerke = $2,
       gewerke = ARRAY(SELECT DISTINCT unnest(gewerke || $2::text[]))
       WHERE id = $3`,
      [status, newlyVerified, userId]
    )
    await logAdminAction(admin.id, status === 'verified' ? 'DOCUMENT_APPROVED' : status === 'rejected' ? 'DOCUMENT_REJECTED' : 'USER_UNVERIFIED', 'user', userId, { status, verifiedGewerke: newlyVerified }, req)
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    return handleApiError(err, 'Aktion fehlgeschlagen.')
  }
}

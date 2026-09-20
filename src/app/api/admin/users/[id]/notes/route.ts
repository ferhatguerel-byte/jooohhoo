import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getDb } from '@/lib/db'
import { requireAdminApi } from '@/lib/authorization'
import { handleApiError } from '@/lib/api-error'
import { logAdminAction } from '@/lib/admin-audit'

const schema = z.object({ notes: z.string().max(5000) })

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: userId } = await params
  try {
    const admin = await requireAdminApi()
    const { notes } = schema.parse(await req.json())
    await getDb().query('UPDATE users SET admin_notes = $1 WHERE id = $2', [notes || null, userId])
    await logAdminAction(admin.id, 'NOTES_UPDATED', 'user', userId, {}, req)
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    return handleApiError(err, 'Notizen konnten nicht gespeichert werden.')
  }
}

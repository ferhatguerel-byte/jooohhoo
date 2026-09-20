import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getDb } from '@/lib/db'
import { requireAdminApi } from '@/lib/authorization'
import { handleApiError } from '@/lib/api-error'
import { logAdminAction } from '@/lib/admin-audit'

const schema = z.object({ status: z.enum(['active', 'suspended']) })

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: userId } = await params
  try {
    const admin = await requireAdminApi()
    const { status } = schema.parse(await req.json())
    await getDb().query('UPDATE users SET account_status = $1 WHERE id = $2', [status, userId])
    await logAdminAction(admin.id, status === 'suspended' ? 'USER_SUSPENDED' : 'USER_UNSUSPENDED', 'user', userId, {}, req)
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    return handleApiError(err, 'Aktion fehlgeschlagen.')
  }
}

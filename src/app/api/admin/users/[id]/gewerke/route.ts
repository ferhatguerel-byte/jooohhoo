import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getDb } from '@/lib/db'
import { requireAdminApi } from '@/lib/authorization'
import { handleApiError } from '@/lib/api-error'
import { logAdminAction } from '@/lib/admin-audit'
import { GEWERKE } from '@/lib/gewerke'

const schema = z.object({ gewerk: z.enum(GEWERKE), blocked: z.boolean() })

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: userId } = await params
  try {
    const admin = await requireAdminApi()
    const { gewerk, blocked } = schema.parse(await req.json())
    const db = getDb()

    if (blocked) {
      await db.query(
        `UPDATE users SET blocked_gewerke = array_append(blocked_gewerke, $1)
         WHERE id = $2 AND NOT ($1 = ANY(blocked_gewerke))`,
        [gewerk, userId]
      )
    } else {
      await db.query(
        `UPDATE users SET blocked_gewerke = array_remove(blocked_gewerke, $1) WHERE id = $2`,
        [gewerk, userId]
      )
    }

    await logAdminAction(admin.id, blocked ? 'GEWERK_BLOCKED' : 'GEWERK_UNBLOCKED', 'user', userId, { gewerk }, req)
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    return handleApiError(err, 'Aktion fehlgeschlagen.')
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getDb } from '@/lib/db'
import { getCurrentUser } from '@/lib/current-user'
import { GEWERKE } from '@/lib/gewerke'

const schema = z.object({ gewerk: z.enum(GEWERKE), blocked: z.boolean() })

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: userId } = await params
  const admin = await getCurrentUser()
  if (!admin || !process.env.ADMIN_EMAIL || admin.email !== process.env.ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Kein Zugriff.' }, { status: 403 })
  }

  try {
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

    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0]?.message || 'Ungültige Eingabe.' }, { status: 400 })
    }
    const message = err instanceof Error ? err.message : 'Unbekannter Fehler'
    console.error('Gewerk sperren Fehler:', message)
    return NextResponse.json({ error: 'Aktion fehlgeschlagen.' }, { status: 500 })
  }
}

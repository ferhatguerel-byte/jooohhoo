import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getDb } from '@/lib/db'
import { getCurrentUser } from '@/lib/current-user'

const schema = z.object({ notes: z.string().max(5000) })

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: userId } = await params
  const admin = await getCurrentUser()
  if (!admin || !process.env.ADMIN_EMAIL || admin.email !== process.env.ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Kein Zugriff.' }, { status: 403 })
  }

  try {
    const { notes } = schema.parse(await req.json())
    await getDb().query('UPDATE users SET admin_notes = $1 WHERE id = $2', [notes || null, userId])
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0]?.message || 'Ungültige Eingabe.' }, { status: 400 })
    }
    const message = err instanceof Error ? err.message : 'Unbekannter Fehler'
    console.error('Notizen Fehler:', message)
    return NextResponse.json({ error: 'Notizen konnten nicht gespeichert werden.' }, { status: 500 })
  }
}

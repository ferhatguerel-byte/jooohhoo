import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getDb } from '@/lib/db'
import { getCurrentUser } from '@/lib/current-user'

const schema = z.object({ status: z.enum(['active', 'suspended']) })

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: userId } = await params
  const admin = await getCurrentUser()
  if (!admin || !process.env.ADMIN_EMAIL || admin.email !== process.env.ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Kein Zugriff.' }, { status: 403 })
  }

  try {
    const { status } = schema.parse(await req.json())
    await getDb().query('UPDATE users SET account_status = $1 WHERE id = $2', [status, userId])
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0]?.message || 'Ungültige Eingabe.' }, { status: 400 })
    }
    const message = err instanceof Error ? err.message : 'Unbekannter Fehler'
    console.error('Kontostatus Fehler:', message)
    return NextResponse.json({ error: 'Aktion fehlgeschlagen.' }, { status: 500 })
  }
}

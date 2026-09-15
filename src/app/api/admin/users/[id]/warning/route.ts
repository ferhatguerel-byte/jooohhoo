import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getDb } from '@/lib/db'
import { getCurrentUser } from '@/lib/current-user'
import { sendAdminWarningEmail } from '@/lib/email'

const schema = z.object({ message: z.string().min(1).max(2000) })

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: userId } = await params
  const admin = await getCurrentUser()
  if (!admin || !process.env.ADMIN_EMAIL || admin.email !== process.env.ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Kein Zugriff.' }, { status: 403 })
  }

  try {
    const { message } = schema.parse(await req.json())
    const db = getDb()

    const target = await db.query('SELECT email, company_name FROM users WHERE id = $1', [userId])
    if (target.rows.length === 0) {
      return NextResponse.json({ error: 'Nutzer nicht gefunden.' }, { status: 404 })
    }

    await db.query('INSERT INTO admin_warnings (user_id, message) VALUES ($1, $2)', [userId, message])

    try {
      await sendAdminWarningEmail(target.rows[0].email, target.rows[0].company_name, message)
    } catch (emailErr) {
      console.error('Mahnung E-Mail Fehler:', emailErr)
    }

    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0]?.message || 'Ungültige Eingabe.' }, { status: 400 })
    }
    const message = err instanceof Error ? err.message : 'Unbekannter Fehler'
    console.error('Mahnung Fehler:', message)
    return NextResponse.json({ error: 'Mahnung konnte nicht gesendet werden.' }, { status: 500 })
  }
}

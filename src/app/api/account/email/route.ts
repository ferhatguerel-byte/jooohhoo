import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getDb } from '@/lib/db'
import { getCurrentUser } from '@/lib/current-user'
import { verifyPassword } from '@/lib/auth'

const schema = z.object({
  newEmail: z.string().email('Bitte eine gültige E-Mail-Adresse angeben.'),
  currentPassword: z.string().min(1, 'Bitte aktuelles Passwort eingeben.'),
})

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Nicht angemeldet.' }, { status: 401 })

  try {
    const { newEmail, currentPassword } = schema.parse(await req.json())
    const db = getDb()

    const result = await db.query('SELECT password_hash FROM users WHERE id = $1', [user.id])
    const valid = await verifyPassword(currentPassword, result.rows[0].password_hash)
    if (!valid) {
      return NextResponse.json({ error: 'Das aktuelle Passwort ist falsch.' }, { status: 400 })
    }

    const existing = await db.query('SELECT id FROM users WHERE email = $1 AND id != $2', [newEmail, user.id])
    if (existing.rows.length > 0) {
      return NextResponse.json({ error: 'Diese E-Mail-Adresse wird bereits verwendet.' }, { status: 409 })
    }

    await db.query('UPDATE users SET email = $1 WHERE id = $2', [newEmail, user.id])

    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0]?.message || 'Ungültige Eingabe.' }, { status: 400 })
    }
    const message = err instanceof Error ? err.message : 'Unbekannter Fehler'
    console.error('E-Mail ändern Fehler:', message)
    return NextResponse.json({ error: 'E-Mail-Adresse konnte nicht geändert werden.' }, { status: 500 })
  }
}

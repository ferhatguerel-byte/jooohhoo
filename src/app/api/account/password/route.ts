import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getDb } from '@/lib/db'
import { getCurrentUser } from '@/lib/current-user'
import { hashPassword, verifyPassword } from '@/lib/auth'
import { handleApiError } from '@/lib/api-error'

const schema = z.object({
  currentPassword: z.string().min(1, 'Bitte aktuelles Passwort eingeben.'),
  newPassword: z.string().min(8, 'Neues Passwort muss mindestens 8 Zeichen haben.'),
})

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Nicht angemeldet.' }, { status: 401 })

  try {
    const { currentPassword, newPassword } = schema.parse(await req.json())
    const db = getDb()

    const result = await db.query('SELECT password_hash FROM users WHERE id = $1', [user.id])
    const valid = await verifyPassword(currentPassword, result.rows[0].password_hash)
    if (!valid) {
      return NextResponse.json({ error: 'Das aktuelle Passwort ist falsch.' }, { status: 400 })
    }

    const newHash = await hashPassword(newPassword)
    await db.query('UPDATE users SET password_hash = $1 WHERE id = $2', [newHash, user.id])

    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    return handleApiError(err, 'Passwort konnte nicht geändert werden.')
  }
}

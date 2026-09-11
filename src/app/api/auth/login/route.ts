import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getDb } from '@/lib/db'
import { verifyPassword, createSessionCookie } from '@/lib/auth'

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export async function POST(req: NextRequest) {
  try {
    const body = loginSchema.parse(await req.json())
    const db = getDb()

    const result = await db.query(
      'SELECT id, role, password_hash FROM users WHERE email = $1',
      [body.email]
    )
    const user = result.rows[0]

    if (!user || !(await verifyPassword(body.password, user.password_hash))) {
      return NextResponse.json({ error: 'E-Mail oder Passwort ist falsch.' }, { status: 401 })
    }

    await createSessionCookie({ userId: user.id, role: user.role })
    return NextResponse.json({ ok: true, role: user.role })
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0]?.message || 'Ungültige Eingabe.' }, { status: 400 })
    }
    const message = err instanceof Error ? err.message : 'Unbekannter Fehler'
    console.error('Login Fehler:', message)
    return NextResponse.json({ error: 'Login fehlgeschlagen.' }, { status: 500 })
  }
}

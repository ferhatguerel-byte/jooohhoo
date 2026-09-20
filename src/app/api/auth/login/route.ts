import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getDb } from '@/lib/db'
import { verifyPassword, createSessionCookie } from '@/lib/auth'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'
import { handleApiError } from '@/lib/api-error'

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export async function POST(req: NextRequest) {
  try {
    const body = loginSchema.parse(await req.json())

    const allowed = await checkRateLimit('login', `${getClientIp(req)}:${body.email}`, 10, 15)
    if (!allowed) {
      return NextResponse.json(
        { error: 'Zu viele Anmeldeversuche. Bitte warten Sie einige Minuten und versuchen Sie es erneut.' },
        { status: 429 }
      )
    }

    const db = getDb()

    const result = await db.query(
      'SELECT id, role, password_hash, account_status FROM users WHERE email = $1',
      [body.email]
    )
    const user = result.rows[0]

    if (!user || !(await verifyPassword(body.password, user.password_hash))) {
      return NextResponse.json({ error: 'E-Mail oder Passwort ist falsch.' }, { status: 401 })
    }
    if (user.account_status === 'suspended') {
      return NextResponse.json(
        { error: 'Ihr Konto wurde gesperrt. Bitte kontaktieren Sie den Support.' },
        { status: 403 }
      )
    }

    await createSessionCookie({ userId: user.id, role: user.role })
    return NextResponse.json({ ok: true, role: user.role })
  } catch (err: unknown) {
    return handleApiError(err, 'Login fehlgeschlagen.')
  }
}

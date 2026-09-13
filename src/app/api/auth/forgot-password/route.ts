import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getDb } from '@/lib/db'
import { generateResetToken } from '@/lib/auth'
import { sendPasswordResetEmail } from '@/lib/email'
import { getAppUrl } from '@/lib/url'

const schema = z.object({ email: z.string().email() })

export async function POST(req: NextRequest) {
  try {
    const { email } = schema.parse(await req.json())
    const db = getDb()

    const user = await db.query('SELECT id FROM users WHERE email = $1', [email])

    if (user.rows.length > 0) {
      const { token, tokenHash } = generateResetToken()
      await db.query(
        `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
         VALUES ($1, $2, now() + interval '1 hour')`,
        [user.rows[0].id, tokenHash]
      )
      const appUrl = getAppUrl(req)
      const resetUrl = `${appUrl}/passwort-vergessen/neu?token=${token}`
      try {
        await sendPasswordResetEmail(email, resetUrl)
      } catch (emailErr) {
        console.error('Benachrichtigung fehlgeschlagen:', emailErr)
      }
    }

    // Immer dieselbe Antwort, unabhängig davon ob die E-Mail existiert.
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0]?.message || 'Ungültige Eingabe.' }, { status: 400 })
    }
    console.error('Passwort-vergessen Fehler:', err instanceof Error ? err.message : err)
    return NextResponse.json({ ok: true })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getDb } from '@/lib/db'
import { hashPassword, hashResetToken } from '@/lib/auth'
import { handleApiError } from '@/lib/api-error'
import { rateLimit, getClientIp } from '@/lib/security/rate-limit'

const schema = z.object({
  token: z.string().min(1).max(500),
  password: z.string().min(8),
})

export async function POST(req: NextRequest) {
  try {
    const { token, password } = schema.parse(await req.json())

    // Phase 4.3 (Teil 5): das Token-Einlösen selbst hatte kein Rate Limit (nur die
    // vorgelagerte Anfrage in /api/auth/forgot-password, siehe dort). Defense-in-depth gegen
    // automatisiertes Durchprobieren von Tokens/allgemeinen Spam auf diesen Endpunkt, IP-basiert
    // (der Token selbst ist unauthentifiziert per Definition).
    await rateLimit({ key: `reset-password:${getClientIp(req)}`, limit: 10, windowSeconds: 3600 })

    const db = getDb()
    const tokenHash = hashResetToken(token)

    const result = await db.query(
      `SELECT id, user_id FROM password_reset_tokens
       WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()`,
      [tokenHash]
    )
    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Der Link ist ungültig oder abgelaufen. Bitte fordern Sie einen neuen an.' }, { status: 400 })
    }
    const { id: tokenId, user_id: userId } = result.rows[0]

    const passwordHash = await hashPassword(password)
    await db.query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, userId])
    await db.query('UPDATE password_reset_tokens SET used_at = now() WHERE id = $1', [tokenId])

    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    return handleApiError(err, 'Passwort konnte nicht zurückgesetzt werden.')
  }
}

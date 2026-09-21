import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getDb } from '@/lib/db'
import { hashPassword, createSessionCookie } from '@/lib/auth'
import { GEWERKE } from '@/lib/gewerke'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'
import { handleApiError } from '@/lib/api-error'

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(['auftraggeber', 'subunternehmer']),
  companyName: z.string().min(2).max(150),
  phone: z.string().optional(),
  plz: z.string().min(4),
  ort: z.string().min(2),
  gewerke: z.array(z.enum(GEWERKE)).optional(),
})

export async function POST(req: NextRequest) {
  try {
    const body = registerSchema.parse(await req.json())

    const allowed = await checkRateLimit('register', getClientIp(req), 8, 60)
    if (!allowed) {
      return NextResponse.json(
        { error: 'Zu viele Registrierungen von dieser Verbindung. Bitte versuchen Sie es später erneut.' },
        { status: 429 }
      )
    }

    const db = getDb()

    const existing = await db.query('SELECT id FROM users WHERE email = $1', [body.email])
    if (existing.rows.length > 0) {
      return NextResponse.json({ error: 'Diese E-Mail-Adresse ist bereits registriert.' }, { status: 409 })
    }

    const passwordHash = await hashPassword(body.password)
    const gewerke = body.role === 'subunternehmer' ? body.gewerke || [] : []

    const result = await db.query(
      `INSERT INTO users (email, password_hash, role, company_name, phone, plz, ort, gewerke)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, role`,
      [body.email, passwordHash, body.role, body.companyName, body.phone || null, body.plz, body.ort, gewerke]
    )

    const user = result.rows[0]
    await createSessionCookie({ userId: user.id, role: user.role })

    return NextResponse.json({ ok: true, role: user.role })
  } catch (err: unknown) {
    return handleApiError(err, 'Registrierung fehlgeschlagen.')
  }
}

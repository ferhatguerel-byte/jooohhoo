import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getDb } from '@/lib/db'
import { hashPassword, createSessionCookie } from '@/lib/auth'
import { GEWERKE } from '@/lib/gewerke'

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(['auftraggeber', 'subunternehmer']),
  companyName: z.string().min(2),
  phone: z.string().optional(),
  plz: z.string().min(4),
  ort: z.string().min(2),
  gewerke: z.array(z.enum(GEWERKE)).optional(),
})

export async function POST(req: NextRequest) {
  try {
    const body = registerSchema.parse(await req.json())
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
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0]?.message || 'Ungültige Eingabe.' }, { status: 400 })
    }
    const message = err instanceof Error ? err.message : 'Unbekannter Fehler'
    console.error('Registrierung Fehler:', message)
    return NextResponse.json({ error: 'Registrierung fehlgeschlagen.' }, { status: 500 })
  }
}

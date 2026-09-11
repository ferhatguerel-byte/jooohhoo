import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getDb } from '@/lib/db'
import { getCurrentUser } from '@/lib/current-user'
import { GEWERKE } from '@/lib/gewerke'

const profileSchema = z.object({
  companyName: z.string().min(2),
  phone: z.string().optional(),
  plz: z.string().min(4),
  ort: z.string().min(2),
  gewerke: z.array(z.enum(GEWERKE)).optional(),
})

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Nicht angemeldet.' }, { status: 401 })
  }

  try {
    const body = profileSchema.parse(await req.json())
    const gewerke = user.role === 'subunternehmer' ? body.gewerke || [] : []

    await getDb().query(
      `UPDATE users SET company_name = $1, phone = $2, plz = $3, ort = $4, gewerke = $5 WHERE id = $6`,
      [body.companyName, body.phone || null, body.plz, body.ort, gewerke, user.id]
    )

    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0]?.message || 'Ungültige Eingabe.' }, { status: 400 })
    }
    const message = err instanceof Error ? err.message : 'Unbekannter Fehler'
    console.error('Profil aktualisieren Fehler:', message)
    return NextResponse.json({ error: 'Profil konnte nicht gespeichert werden.' }, { status: 500 })
  }
}

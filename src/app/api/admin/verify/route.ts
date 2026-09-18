import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getDb } from '@/lib/db'
import { getCurrentUser } from '@/lib/current-user'

const schema = z.object({
  userId: z.string().uuid(),
  status: z.enum(['verified', 'rejected', 'unverified']),
  verifiedGewerke: z.array(z.string()).optional(),
})

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  const adminEmail = process.env.ADMIN_EMAIL
  if (!adminEmail || !user || user.email !== adminEmail) {
    return NextResponse.json({ error: 'Kein Zugriff.' }, { status: 403 })
  }

  try {
    const { userId, status, verifiedGewerke } = schema.parse(await req.json())
    const newlyVerified = status === 'verified' ? verifiedGewerke || [] : []
    await getDb().query(
      `UPDATE users SET verification_status = $1, verified_gewerke = $2,
       gewerke = ARRAY(SELECT DISTINCT unnest(gewerke || $2::text[]))
       WHERE id = $3`,
      [status, newlyVerified, userId]
    )
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0]?.message || 'Ungültige Eingabe.' }, { status: 400 })
    }
    const message = err instanceof Error ? err.message : 'Unbekannter Fehler'
    console.error('Verifizierung Fehler:', message)
    return NextResponse.json({ error: 'Aktion fehlgeschlagen.' }, { status: 500 })
  }
}

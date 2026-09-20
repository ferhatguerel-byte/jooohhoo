import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getDb } from '@/lib/db'
import { getCurrentUser } from '@/lib/current-user'
import { handleApiError } from '@/lib/api-error'

const schema = z.object({ listed: z.boolean() })

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'subunternehmer') {
    return NextResponse.json({ error: 'Nicht angemeldet.' }, { status: 401 })
  }

  try {
    const { listed } = schema.parse(await req.json())
    await getDb().query('UPDATE users SET directory_listed = $1 WHERE id = $2', [listed, user.id])
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    return handleApiError(err, 'Einstellung konnte nicht gespeichert werden.')
  }
}

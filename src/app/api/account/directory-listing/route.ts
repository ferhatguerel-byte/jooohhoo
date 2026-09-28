import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getDb } from '@/lib/db'
import { requireActiveUserApi } from '@/lib/authorization'
import { handleApiError } from '@/lib/api-error'

const schema = z.object({ listed: z.boolean() })

export async function POST(req: NextRequest) {
  try {
    // requireActiveUserApi() statt getCurrentUser(): ein gesperrtes/gelöschtes Konto darf die
    // Directory-Einstellung über eine noch gültige Session nicht mehr ändern (publicProviderSqlCondition()
    // schließt es ohnehin unabhängig davon aus, aber die Aktion selbst soll gar nicht erst möglich sein).
    const user = await requireActiveUserApi()
    if (user.role !== 'subunternehmer') {
      return NextResponse.json({ error: 'Nicht angemeldet.' }, { status: 401 })
    }
    const { listed } = schema.parse(await req.json())
    await getDb().query('UPDATE users SET directory_listed = $1 WHERE id = $2', [listed, user.id])
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    return handleApiError(err, 'Einstellung konnte nicht gespeichert werden.')
  }
}

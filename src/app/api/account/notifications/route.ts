import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getDb } from '@/lib/db'
import { requireActiveUserApi } from '@/lib/authorization'
import { handleApiError } from '@/lib/api-error'

const schema = z.object({
  emailNotifications: z.boolean(),
  newsletterOptIn: z.boolean(),
})

export async function POST(req: NextRequest) {
  try {
    // requireActiveUserApi(): ein gesperrtes/gelöschtes Konto darf seine Kontoeinstellungen über
    // eine noch gültige Session nicht mehr ändern.
    const user = await requireActiveUserApi()
    const { emailNotifications, newsletterOptIn } = schema.parse(await req.json())
    await getDb().query(
      'UPDATE users SET email_notifications = $1, newsletter_opt_in = $2 WHERE id = $3',
      [emailNotifications, newsletterOptIn, user.id]
    )
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    return handleApiError(err, 'Einstellungen konnten nicht gespeichert werden.')
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getDb } from '@/lib/db'
import { getCurrentUser } from '@/lib/current-user'
import { handleApiError } from '@/lib/api-error'

const schema = z.object({
  emailNotifications: z.boolean(),
  newsletterOptIn: z.boolean(),
})

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Nicht angemeldet.' }, { status: 401 })

  try {
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

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getDb } from '@/lib/db'
import { requireAdminApi } from '@/lib/authorization'
import { handleApiError } from '@/lib/api-error'
import { logAdminAction } from '@/lib/admin-audit'
import { sendAdminWarningEmail } from '@/lib/email'

const schema = z.object({ message: z.string().min(1).max(2000) })

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: userId } = await params
  try {
    const admin = await requireAdminApi()
    const { message } = schema.parse(await req.json())
    const db = getDb()

    const target = await db.query('SELECT email, company_name FROM users WHERE id = $1', [userId])
    if (target.rows.length === 0) {
      return NextResponse.json({ error: 'Nutzer nicht gefunden.' }, { status: 404 })
    }

    await db.query('INSERT INTO admin_warnings (user_id, message) VALUES ($1, $2)', [userId, message])
    await logAdminAction(admin.id, 'WARNING_SENT', 'user', userId, { message }, req)

    try {
      await sendAdminWarningEmail(target.rows[0].email, target.rows[0].company_name, message)
    } catch (emailErr) {
      console.error('Mahnung E-Mail Fehler:', emailErr)
    }

    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    return handleApiError(err, 'Mahnung konnte nicht gesendet werden.')
  }
}

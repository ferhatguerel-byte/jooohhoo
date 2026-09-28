import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { requireActiveUserApi } from '@/lib/authorization'
import { handleApiError } from '@/lib/api-error'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: jobId } = await params
  try {
    // requireActiveUserApi(): ein gesperrtes/gelöschtes Konto darf über eine noch gültige Session
    // keine neuen Hide-Aktionen mehr auslösen.
    const user = await requireActiveUserApi()
    if (user.role !== 'subunternehmer') {
      return NextResponse.json({ error: 'Kein Zugriff.' }, { status: 403 })
    }

    await getDb().query(
      `INSERT INTO hidden_jobs (user_id, job_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [user.id, jobId]
    )
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    return handleApiError(err, 'Auftrag konnte nicht ausgeblendet werden.')
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: jobId } = await params
  try {
    // requireActiveUserApi(): ein gesperrtes/gelöschtes Konto darf über eine noch gültige Session
    // keine Unhide-Aktion mehr auslösen.
    const user = await requireActiveUserApi()
    if (user.role !== 'subunternehmer') {
      return NextResponse.json({ error: 'Kein Zugriff.' }, { status: 403 })
    }

    await getDb().query('DELETE FROM hidden_jobs WHERE user_id = $1 AND job_id = $2', [user.id, jobId])
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    return handleApiError(err, 'Auftrag konnte nicht wieder eingeblendet werden.')
  }
}

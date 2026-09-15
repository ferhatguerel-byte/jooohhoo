import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getCurrentUser } from '@/lib/current-user'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: jobId } = await params
  const user = await getCurrentUser()
  if (!user || user.role !== 'subunternehmer') {
    return NextResponse.json({ error: 'Kein Zugriff.' }, { status: 403 })
  }

  await getDb().query(
    `INSERT INTO hidden_jobs (user_id, job_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [user.id, jobId]
  )
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: jobId } = await params
  const user = await getCurrentUser()
  if (!user || user.role !== 'subunternehmer') {
    return NextResponse.json({ error: 'Kein Zugriff.' }, { status: 403 })
  }

  await getDb().query('DELETE FROM hidden_jobs WHERE user_id = $1 AND job_id = $2', [user.id, jobId])
  return NextResponse.json({ ok: true })
}

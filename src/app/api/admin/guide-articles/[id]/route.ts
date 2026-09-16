import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getDb } from '@/lib/db'
import { getCurrentUser } from '@/lib/current-user'

const schema = z.object({
  title: z.string().min(3).max(200),
  excerpt: z.string().min(10).max(500),
  content: z.string().min(50),
  metaDescription: z.string().max(300).optional(),
  published: z.boolean(),
})

function isAdmin(email: string) {
  return !!process.env.ADMIN_EMAIL && email === process.env.ADMIN_EMAIL
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser()
  if (!user || !isAdmin(user.email)) {
    return NextResponse.json({ error: 'Kein Zugriff.' }, { status: 403 })
  }

  try {
    const body = schema.parse(await req.json())
    await getDb().query(
      `UPDATE guide_articles SET title = $1, excerpt = $2, content = $3, meta_description = $4,
       published = $5, updated_at = now() WHERE id = $6`,
      [body.title, body.excerpt, body.content, body.metaDescription || null, body.published, id]
    )
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0]?.message || 'Ungültige Eingabe.' }, { status: 400 })
    }
    const message = err instanceof Error ? err.message : 'Unbekannter Fehler'
    console.error('Ratgeber-Artikel aktualisieren Fehler:', message)
    return NextResponse.json({ error: 'Artikel konnte nicht gespeichert werden.' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser()
  if (!user || !isAdmin(user.email)) {
    return NextResponse.json({ error: 'Kein Zugriff.' }, { status: 403 })
  }

  await getDb().query('DELETE FROM guide_articles WHERE id = $1', [id])
  return NextResponse.json({ ok: true })
}

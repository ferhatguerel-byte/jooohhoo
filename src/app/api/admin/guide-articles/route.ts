import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getDb } from '@/lib/db'
import { getCurrentUser } from '@/lib/current-user'
import { slugify } from '@/lib/slugify'

const schema = z.object({
  title: z.string().min(3).max(200),
  excerpt: z.string().min(10).max(500),
  content: z.string().min(50),
  metaDescription: z.string().max(300).optional(),
  published: z.boolean().default(true),
})

function isAdmin(email: string) {
  return !!process.env.ADMIN_EMAIL && email === process.env.ADMIN_EMAIL
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user || !isAdmin(user.email)) {
    return NextResponse.json({ error: 'Kein Zugriff.' }, { status: 403 })
  }

  try {
    const body = schema.parse(await req.json())
    const db = getDb()

    const baseSlug = slugify(body.title)
    let slug = baseSlug
    let suffix = 1
    while ((await db.query('SELECT id FROM guide_articles WHERE slug = $1', [slug])).rows.length > 0) {
      suffix += 1
      slug = `${baseSlug}-${suffix}`
    }

    const result = await db.query(
      `INSERT INTO guide_articles (slug, title, excerpt, content, meta_description, published)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [slug, body.title, body.excerpt, body.content, body.metaDescription || null, body.published]
    )

    return NextResponse.json({ ok: true, id: result.rows[0].id, slug })
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0]?.message || 'Ungültige Eingabe.' }, { status: 400 })
    }
    const message = err instanceof Error ? err.message : 'Unbekannter Fehler'
    console.error('Ratgeber-Artikel erstellen Fehler:', message)
    return NextResponse.json({ error: 'Artikel konnte nicht erstellt werden.' }, { status: 500 })
  }
}

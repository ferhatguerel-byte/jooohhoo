import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getDb } from '@/lib/db'
import { requireAdminApi } from '@/lib/authorization'
import { handleApiError } from '@/lib/api-error'
import { logAdminAction } from '@/lib/admin-audit'
import { slugify } from '@/lib/slugify'

const schema = z.object({
  title: z.string().min(3).max(200),
  excerpt: z.string().min(10).max(500),
  content: z.string().min(50),
  metaDescription: z.string().max(300).optional(),
  published: z.boolean().default(true),
})

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdminApi()
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

    await logAdminAction(admin.id, 'GUIDE_ARTICLE_CREATED', 'guide_article', result.rows[0].id, { title: body.title, slug }, req)
    return NextResponse.json({ ok: true, id: result.rows[0].id, slug })
  } catch (err: unknown) {
    return handleApiError(err, 'Artikel konnte nicht erstellt werden.')
  }
}

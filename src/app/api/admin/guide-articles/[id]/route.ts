import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getDb } from '@/lib/db'
import { requireAdminApi } from '@/lib/authorization'
import { handleApiError } from '@/lib/api-error'
import { logAdminAction } from '@/lib/admin-audit'

const schema = z.object({
  title: z.string().min(3).max(200),
  excerpt: z.string().min(10).max(500),
  content: z.string().min(50),
  metaDescription: z.string().max(300).optional(),
  published: z.boolean(),
})

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const admin = await requireAdminApi()
    const body = schema.parse(await req.json())
    await getDb().query(
      `UPDATE guide_articles SET title = $1, excerpt = $2, content = $3, meta_description = $4,
       published = $5, updated_at = now() WHERE id = $6`,
      [body.title, body.excerpt, body.content, body.metaDescription || null, body.published, id]
    )
    await logAdminAction(admin.id, 'GUIDE_ARTICLE_UPDATED', 'guide_article', id, { title: body.title, published: body.published }, req)
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    return handleApiError(err, 'Artikel konnte nicht gespeichert werden.')
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const admin = await requireAdminApi()
    await getDb().query('DELETE FROM guide_articles WHERE id = $1', [id])
    await logAdminAction(admin.id, 'GUIDE_ARTICLE_DELETED', 'guide_article', id, {}, req)
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    return handleApiError(err, 'Artikel konnte nicht gelöscht werden.')
  }
}

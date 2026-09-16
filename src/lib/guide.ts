import { getDb } from '@/lib/db'

export interface GuideArticle {
  id: string
  slug: string
  title: string
  excerpt: string
  content: string
  metaDescription: string | null
  published: boolean
  createdAt: string
  updatedAt: string
}

function mapRow(row: {
  id: string
  slug: string
  title: string
  excerpt: string
  content: string
  meta_description: string | null
  published: boolean
  created_at: string
  updated_at: string
}): GuideArticle {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    content: row.content,
    metaDescription: row.meta_description,
    published: row.published,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function getPublishedArticles(): Promise<GuideArticle[]> {
  const result = await getDb().query(
    `SELECT * FROM guide_articles WHERE published = true ORDER BY created_at DESC`
  )
  return result.rows.map(mapRow)
}

export async function getArticleBySlug(slug: string): Promise<GuideArticle | null> {
  const result = await getDb().query(`SELECT * FROM guide_articles WHERE slug = $1 AND published = true`, [slug])
  return result.rows[0] ? mapRow(result.rows[0]) : null
}

export async function getAllArticlesForAdmin(): Promise<GuideArticle[]> {
  const result = await getDb().query(`SELECT * FROM guide_articles ORDER BY created_at DESC`)
  return result.rows.map(mapRow)
}

export async function getArticleByIdForAdmin(id: string): Promise<GuideArticle | null> {
  const result = await getDb().query(`SELECT * FROM guide_articles WHERE id = $1`, [id])
  return result.rows[0] ? mapRow(result.rows[0]) : null
}

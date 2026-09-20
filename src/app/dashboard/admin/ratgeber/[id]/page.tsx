import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/authorization'
import { getArticleByIdForAdmin } from '@/lib/guide'
import ArticleForm from '../ArticleForm'

export default async function EditArtikelPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await requireAdmin()

  const article = await getArticleByIdForAdmin(id)
  if (!article) notFound()

  return (
    <div>
      <h1 className="text-2xl font-black text-slate-900 mb-6">Artikel bearbeiten</h1>
      <ArticleForm
        articleId={article.id}
        initialTitle={article.title}
        initialExcerpt={article.excerpt}
        initialContent={article.content}
        initialMetaDescription={article.metaDescription || ''}
        initialPublished={article.published}
      />
    </div>
  )
}

import { redirect, notFound } from 'next/navigation'
import { getCurrentUser } from '@/lib/current-user'
import { getArticleByIdForAdmin } from '@/lib/guide'
import ArticleForm from '../ArticleForm'

export default async function EditArtikelPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser()
  const adminEmail = process.env.ADMIN_EMAIL
  if (!user) redirect('/login')
  if (!adminEmail || user.email !== adminEmail) redirect('/dashboard')

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

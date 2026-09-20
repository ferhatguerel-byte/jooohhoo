import { requireAdmin } from '@/lib/authorization'
import ArticleForm from '../ArticleForm'

export default async function NeuerArtikelPage() {
  await requireAdmin()

  return (
    <div>
      <h1 className="text-2xl font-black text-slate-900 mb-6">Neuer Ratgeber-Artikel</h1>
      <ArticleForm />
    </div>
  )
}

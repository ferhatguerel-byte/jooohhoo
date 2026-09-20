import Link from 'next/link'
import { requireAdmin } from '@/lib/authorization'
import { getAllArticlesForAdmin } from '@/lib/guide'
import DeleteArticleButton from './DeleteArticleButton'

export default async function AdminRatgeberPage() {
  await requireAdmin()

  const articles = await getAllArticlesForAdmin()

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <h1 className="text-2xl font-black text-slate-900">Ratgeber-Artikel</h1>
        <Link href="/dashboard/admin/ratgeber/neu" className="bg-brand hover:bg-brand-hover text-white text-sm font-bold px-5 py-2.5 rounded-lg">
          + Neuer Artikel
        </Link>
      </div>

      <div className="space-y-3">
        {articles.length === 0 && <p className="text-slate-500">Noch keine Artikel vorhanden.</p>}
        {articles.map((a) => (
          <div key={a.id} className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900">{a.title}</span>
                {!a.published && (
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">Entwurf</span>
                )}
              </div>
              <p className="text-sm text-slate-500">/ratgeber/{a.slug}</p>
            </div>
            <div className="flex items-center gap-3">
              <Link href={`/dashboard/admin/ratgeber/${a.id}`} className="text-sm font-semibold text-brand hover:underline">
                Bearbeiten
              </Link>
              <DeleteArticleButton articleId={a.id} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

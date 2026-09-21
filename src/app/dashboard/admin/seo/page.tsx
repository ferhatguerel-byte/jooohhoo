import Link from 'next/link'
import { requireAdmin } from '@/lib/authorization'
import { listSeoLandingPages, type SeoPageStatus, type SeoPageType } from '@/lib/seo/status'
import { seoPageUrlPath } from '@/lib/seo/page-url'
import SeoFilters from './SeoFilters'

const STATUS_STYLES: Record<SeoPageStatus, string> = {
  DRAFT: 'bg-slate-100 text-slate-500',
  REVIEW: 'bg-orange-100 text-orange-700',
  INDEXABLE: 'bg-green-100 text-green-700',
  NOINDEX: 'bg-red-100 text-red-700',
}

export default async function AdminSeoPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; pageType?: string; gewerkSlug?: string; citySlug?: string; minScore?: string }>
}) {
  await requireAdmin()
  const sp = await searchParams

  const pages = await listSeoLandingPages({
    status: sp.status as SeoPageStatus | undefined,
    pageType: sp.pageType as SeoPageType | undefined,
    gewerkSlug: sp.gewerkSlug || undefined,
    citySlug: sp.citySlug || undefined,
    minScore: sp.minScore ? Number(sp.minScore) : undefined,
  })

  return (
    <div>
      <h1 className="text-2xl font-black text-slate-900 mb-2">SEO-Landingpages</h1>
      <p className="text-slate-500 mb-6">
        Übersicht aller programmatisch bewerteten SEO-Seiten. Ein automatisch ermittelter Score kann eine Seite
        höchstens zur Prüfung vorschlagen (REVIEW) – nur eine explizite Admin-Freigabe setzt INDEXABLE.
      </p>

      <SeoFilters initial={sp} />

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="grid grid-cols-[1fr_1.2fr_0.8fr_0.6fr_0.6fr_0.8fr] gap-2 px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wide border-b border-slate-100">
          <div>URL-Typ</div>
          <div>Kombination</div>
          <div>Status</div>
          <div>Quelle</div>
          <div>Score</div>
          <div>Aktualisiert</div>
        </div>
        {pages.length === 0 && <p className="text-slate-500 px-4 py-6">Keine Seiten für diese Filter gefunden.</p>}
        {pages.map((p) => {
          const url = seoPageUrlPath(p)
          return (
            <Link
              key={p.id}
              href={`/dashboard/admin/seo/${p.id}`}
              className="grid grid-cols-[1fr_1.2fr_0.8fr_0.6fr_0.6fr_0.8fr] gap-2 px-4 py-3 text-sm border-b border-slate-50 last:border-0 hover:bg-slate-50 transition items-center"
            >
              <div className="font-mono text-xs text-slate-500">{p.pageType}</div>
              <div className="font-semibold text-slate-800 truncate">{url || '(URL nicht auflösbar)'}</div>
              <div>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${STATUS_STYLES[p.status]}`}>{p.status}</span>
              </div>
              <div className="text-xs text-slate-400">{p.statusSource}</div>
              <div className="text-xs font-bold text-slate-700">{p.score ?? '–'}/100</div>
              <div className="text-xs text-slate-400">{new Date(p.updatedAt).toLocaleDateString('de-DE')}</div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

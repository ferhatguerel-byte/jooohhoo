import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { requireAdmin } from '@/lib/authorization'
import { getSeoLandingPageById } from '@/lib/seo/status'
import { QUALITY_WEIGHTS, CRITERION_LABELS, type QualityCriterion } from '@/lib/seo/quality-score'
import { seoPageUrlPath } from '@/lib/seo/page-url'
import { getAppUrl } from '@/lib/url'
import SeoStatusActions from './SeoStatusActions'

export default async function AdminSeoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin()
  const { id } = await params
  const page = await getSeoLandingPageById(id)
  if (!page) notFound()

  const urlPath = seoPageUrlPath(page)
  const criteria = Object.keys(QUALITY_WEIGHTS) as QualityCriterion[]

  return (
    <div>
      <Link href="/dashboard/admin/seo" className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-brand mb-6">
        <ArrowLeft size={14} /> Zurück zur Übersicht
      </Link>

      <h1 className="text-2xl font-black text-slate-900 mb-1">{urlPath || page.pageType}</h1>
      <p className="text-slate-500 mb-6">
        Typ: <span className="font-mono">{page.pageType}</span>
        {page.gewerkSlug && <> · Gewerk: <span className="font-mono">{page.gewerkSlug}</span></>}
        {page.citySlug && <> · Stadt: <span className="font-mono">{page.citySlug}</span></>}
      </p>

      {urlPath && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-6 flex items-center justify-between gap-4 flex-wrap">
          <div className="text-sm">
            <span className="text-slate-400">Öffentliche URL:</span>{' '}
            <span className="font-mono text-slate-700">{getAppUrl()}{urlPath}</span>
          </div>
          <a href={urlPath} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-brand hover:underline">
            Seite ansehen →
          </a>
        </div>
      )}

      <div className="grid md:grid-cols-[1fr_1fr] gap-6 mb-6">
        <div className="bg-white border border-slate-200 rounded-2xl p-6">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Quality Score</p>
          <div className="text-4xl font-black text-slate-900 mb-4">{page.score ?? '–'}/100</div>
          <div className="space-y-3">
            {criteria.map((c) => {
              const points = page.breakdown[c] ?? 0
              const max = QUALITY_WEIGHTS[c]
              const missing = page.missingReasons[c]
              return (
                <div key={c}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="font-semibold text-slate-700">{CRITERION_LABELS[c]}</span>
                    <span className="font-mono text-slate-500">{points}/{max}</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${points === max ? 'bg-green-500' : points > 0 ? 'bg-orange-400' : 'bg-red-300'}`}
                      style={{ width: `${max > 0 ? (points / max) * 100 : 0}%` }}
                    />
                  </div>
                  {missing && <p className="text-xs text-slate-400 mt-1">{missing}</p>}
                </div>
              )
            })}
          </div>
        </div>

        <SeoStatusActions id={page.id} currentStatus={page.status} statusSource={page.statusSource} initialNote={page.adminNote || ''} />
      </div>

      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm text-slate-500">
        Zuletzt bewertet: {new Date(page.updatedAt).toLocaleString('de-DE')} · Aktueller Status:{' '}
        <span className="font-bold text-slate-700">{page.status}</span> ({page.statusSource === 'ADMIN' ? 'von einem Admin gesetzt' : 'automatisch ermittelt'})
      </div>
    </div>
  )
}

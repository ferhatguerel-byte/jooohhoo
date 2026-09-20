import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { ArrowLeft } from 'lucide-react'
import { getArticleBySlug, getPublishedArticles } from '@/lib/guide'
import ArticleContent from '@/components/ArticleContent'
import { getCurrentUser } from '@/lib/current-user'
import { buildBreadcrumbJsonLd } from '@/lib/seo/structured-data'
import HomeHeader from '../../HomeHeader'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const article = await getArticleBySlug(slug)
  if (!article) return {}

  return {
    title: article.title,
    description: article.metaDescription || article.excerpt,
    alternates: { canonical: `/ratgeber/${article.slug}` },
  }
}

export default async function RatgeberArtikelPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const article = await getArticleBySlug(slug)
  if (!article) notFound()
  const user = await getCurrentUser()
  const allArticles = await getPublishedArticles()
  const relatedArticles = allArticles.filter((a) => a.slug !== article.slug).slice(0, 3)

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.title,
    description: article.metaDescription || article.excerpt,
    datePublished: article.createdAt,
    dateModified: article.updatedAt,
    publisher: { '@type': 'Organization', name: 'BAUVERSUS' },
  }
  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: 'Start', path: '/' },
    { name: 'Ratgeber', path: '/ratgeber' },
    { name: article.title, path: `/ratgeber/${article.slug}` },
  ])

  return (
    <div className="min-h-screen bg-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <HomeHeader loggedIn={!!user} />
      <div className="max-w-2xl mx-auto px-6 py-16">
        <Link href="/ratgeber" className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-brand mb-6">
          <ArrowLeft size={14} /> Zurück zum Ratgeber
        </Link>
        <h1 className="text-3xl font-black tracking-tight text-[#17202a] mb-2">{article.title}</h1>
        <p className="text-xs text-slate-400 mb-6">
          Aktualisiert am {new Date(article.updatedAt).toLocaleDateString('de-DE')}
        </p>
        <ArticleContent content={article.content} />

        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 text-center mt-12 mb-12">
          <p className="text-slate-700 font-semibold mb-3">Bereit für Ihr Projekt?</p>
          <Link
            href="/registrieren?rolle=auftraggeber"
            className="bg-accent hover:bg-accent-hover text-white font-bold py-3 px-6 rounded-lg inline-block"
          >
            Jetzt kostenlos Auftrag erstellen →
          </Link>
        </div>

        {relatedArticles.length > 0 && (
          <div>
            <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wide mb-3">Weitere Ratgeber-Artikel</h2>
            <div className="space-y-2">
              {relatedArticles.map((a) => (
                <Link key={a.slug} href={`/ratgeber/${a.slug}`} className="block text-sm font-semibold text-brand hover:underline">
                  {a.title}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

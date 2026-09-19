import Link from 'next/link'
import type { Metadata } from 'next'
import { getPublishedArticles } from '@/lib/guide'
import { getCurrentUser } from '@/lib/current-user'
import HomeHeader from '../HomeHeader'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Ratgeber – Tipps rund um Handwerk und Renovierung',
  description:
    'Praktische Tipps zu Handwerkerauswahl, Kosten und Ablauf von Bau- und Renovierungsprojekten – von BAUVERSUS.',
  alternates: { canonical: '/ratgeber' },
}

export default async function RatgeberPage() {
  const articles = await getPublishedArticles()
  const user = await getCurrentUser()

  return (
    <div className="min-h-screen bg-white">
      <HomeHeader loggedIn={!!user} />
      <div className="max-w-4xl mx-auto px-6 py-16">
        <div className="text-accent font-extrabold text-xs uppercase tracking-widest mb-3">Ratgeber</div>
        <h1 className="text-3xl md:text-4xl font-black tracking-tight text-[#17202a] mb-3">
          Tipps rund um Handwerk und Renovierung
        </h1>
        <p className="text-slate-500 max-w-2xl mb-12">
          Praktisches Wissen für Ihr nächstes Bauprojekt – von der Handwerkerauswahl bis zur Kosteneinschätzung.
        </p>

        <div className="space-y-6">
          {articles.length === 0 && <p className="text-slate-500">Noch keine Artikel veröffentlicht.</p>}
          {articles.map((a) => (
            <Link
              key={a.id}
              href={`/ratgeber/${a.slug}`}
              className="block border border-slate-200 rounded-2xl p-6 hover:border-brand/40 hover:shadow-md transition"
            >
              <h2 className="text-xl font-bold text-[#17202a] mb-2">{a.title}</h2>
              <p className="text-slate-500">{a.excerpt}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}

import Link from 'next/link'
import { Users, ShieldCheck, LifeBuoy, Newspaper, LineChart, Search } from 'lucide-react'
import { requireAdmin } from '@/lib/authorization'
import { getDb } from '@/lib/db'

export default async function AdminDashboardPage() {
  await requireAdmin()

  const db = getDb()
  const [pendingVerifications, openTickets, suspendedUsers, totalUnternehmer, articleCount, seoReviewCount] = await Promise.all([
    db.query(`SELECT COUNT(*)::int AS count FROM users WHERE role = 'subunternehmer' AND verification_status = 'pending'`),
    db.query(`SELECT COUNT(*)::int AS count FROM support_tickets WHERE status = 'open'`),
    db.query(`SELECT COUNT(*)::int AS count FROM users WHERE role = 'subunternehmer' AND account_status = 'suspended'`),
    db.query(`SELECT COUNT(*)::int AS count FROM users WHERE role = 'subunternehmer'`),
    db.query(`SELECT COUNT(*)::int AS count FROM guide_articles`),
    db.query(`SELECT COUNT(*)::int AS count FROM seo_landing_pages WHERE status = 'REVIEW'`),
  ])

  const tiles = [
    {
      href: '/dashboard/admin/nutzer',
      icon: Users,
      title: 'Nutzerverwaltung',
      desc: 'Alle Unternehmer einsehen und bearbeiten: Gewerke sperren, Mahnungen, Konto sperren/kündigen.',
      stat: `${totalUnternehmer.rows[0].count} Unternehmer`,
    },
    {
      href: '/dashboard/admin/verifizierungen',
      icon: ShieldCheck,
      title: 'Verifizierungen',
      desc: 'Hochgeladene Nachweise (Gewerbeanmeldung, Meisterbrief, Haftpflicht) prüfen und freigeben.',
      stat: `${pendingVerifications.rows[0].count} offen`,
      urgent: pendingVerifications.rows[0].count > 0,
    },
    {
      href: '/dashboard/admin/support',
      icon: LifeBuoy,
      title: 'Support-Verwaltung',
      desc: 'Support-Tickets von Nutzern einsehen und beantworten.',
      stat: `${openTickets.rows[0].count} offen`,
      urgent: openTickets.rows[0].count > 0,
    },
    {
      href: '/dashboard/admin/ratgeber',
      icon: Newspaper,
      title: 'Ratgeber-Artikel',
      desc: 'SEO-Inhalte für die öffentliche Ratgeber-Sektion verwalten.',
      stat: `${articleCount.rows[0].count} Artikel`,
    },
    {
      href: '/dashboard/admin/tracking',
      icon: LineChart,
      title: 'Tracking-Dashboard',
      desc: 'Onboarding- und Aktivierungs-Funnel: Registrierungen, Verifizierungen, Abos, Aufträge und Vergaben.',
      stat: 'Übersicht',
    },
    {
      href: '/dashboard/admin/seo',
      icon: Search,
      title: 'SEO-Landingpages',
      desc: 'Quality-Score, Status und Freigabe der programmatischen SEO-Seiten (Handwerker, Nachunternehmer, Branchenbuch).',
      stat: `${seoReviewCount.rows[0].count} zur Prüfung`,
      urgent: seoReviewCount.rows[0].count > 0,
    },
  ]

  return (
    <div>
      <h1 className="text-2xl font-black text-slate-900 mb-2">Admin-Dashboard</h1>
      <p className="text-slate-500 mb-6">
        {suspendedUsers.rows[0].count > 0 && (
          <span className="text-red-600 font-semibold">{suspendedUsers.rows[0].count} gesperrte Konten. </span>
        )}
        Zentrale Übersicht für alle administrativen Tätigkeiten.
      </p>
      <div className="grid md:grid-cols-3 gap-6">
        {tiles.map((tile) => (
          <Link
            key={tile.href}
            href={tile.href}
            className="bg-white border border-slate-200 rounded-2xl p-6 hover:border-brand/40 hover:shadow-md transition"
          >
            <div className="flex items-center justify-between mb-3">
              <tile.icon size={22} className="text-brand" />
              {tile.urgent && (
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">{tile.stat}</span>
              )}
              {!tile.urgent && <span className="text-xs font-semibold text-slate-400">{tile.stat}</span>}
            </div>
            <h2 className="font-bold text-slate-900 mb-1">{tile.title}</h2>
            <p className="text-sm text-slate-500">{tile.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}

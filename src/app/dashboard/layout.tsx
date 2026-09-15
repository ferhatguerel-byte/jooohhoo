import { redirect } from 'next/navigation'
import Link from 'next/link'
import { HardHat } from 'lucide-react'
import { getCurrentUser } from '@/lib/current-user'
import AccountMenu from './AccountMenu'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()
  if (!user) {
    redirect('/login')
  }

  const links = user.role === 'auftraggeber'
    ? [
        { href: '/dashboard/auftraege', label: 'Meine Aufträge' },
      ]
    : [
        { href: '/dashboard/jobs', label: 'Aufträge durchsuchen' },
        { href: '/dashboard/angebote', label: 'Meine Angebote' },
        { href: '/dashboard/abo', label: 'Abo' },
      ]

  const isAdmin = !!process.env.ADMIN_EMAIL && user.email === process.env.ADMIN_EMAIL
  if (isAdmin) {
    links.push({ href: '/dashboard/admin', label: 'Admin-Dashboard' })
  }

  if (user.accountStatus === 'suspended' && !isAdmin) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-6">
        <div className="bg-white border border-red-200 rounded-2xl p-8 max-w-md text-center">
          <h1 className="text-xl font-black text-slate-900 mb-2">Konto gesperrt</h1>
          <p className="text-slate-500 mb-6">
            Ihr Konto wurde vorübergehend gesperrt. Bitte kontaktieren Sie unseren Support, um mehr zu erfahren.
          </p>
          <a href={`mailto:${process.env.ADMIN_EMAIL || ''}`} className="text-brand font-semibold hover:underline">
            Support kontaktieren
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-black text-lg text-slate-900">
            <span className="bg-brand text-white rounded-lg w-8 h-8 flex items-center justify-center">
              <HardHat size={16} />
            </span>
            BAU<span className="text-accent">VERSUS</span>
          </Link>
          <nav className="hidden sm:flex items-center gap-6 text-sm font-medium text-slate-600">
            {links.map((l) => (
              <Link key={l.href} href={l.href} className="hover:text-brand">{l.label}</Link>
            ))}
          </nav>
          <div className="flex items-center gap-4">
            <AccountMenu companyName={user.companyName} isAdmin={isAdmin} />
          </div>
        </div>
        <nav className="sm:hidden flex items-center gap-4 px-6 pb-3 text-sm font-medium text-slate-600 overflow-x-auto">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="hover:text-brand whitespace-nowrap">{l.label}</Link>
          ))}
        </nav>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-10">{children}</main>
    </div>
  )
}

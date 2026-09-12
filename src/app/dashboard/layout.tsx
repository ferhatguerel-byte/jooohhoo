import { redirect } from 'next/navigation'
import Link from 'next/link'
import { HardHat } from 'lucide-react'
import { getCurrentUser } from '@/lib/current-user'
import LogoutButton from './LogoutButton'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()
  if (!user) {
    redirect('/login')
  }

  const links = user.role === 'auftraggeber'
    ? [
        { href: '/dashboard/auftraege', label: 'Meine Aufträge' },
        { href: '/dashboard/abo', label: 'Abo' },
        { href: '/dashboard/profil', label: 'Profil' },
      ]
    : [
        { href: '/dashboard/jobs', label: 'Aufträge durchsuchen' },
        { href: '/dashboard/profil', label: 'Profil' },
      ]

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
            <span className="text-sm text-slate-500 hidden sm:inline">{user.companyName}</span>
            <LogoutButton />
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

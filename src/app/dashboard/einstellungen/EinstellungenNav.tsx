'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Settings, FileText, CreditCard } from 'lucide-react'

export default function EinstellungenNav({ showBilling }: { showBilling: boolean }) {
  const pathname = usePathname()

  const items = [
    { href: '/dashboard/einstellungen', label: 'Konto Einstellungen', icon: Settings },
    ...(showBilling
      ? [
          { href: '/dashboard/einstellungen/rechnungen', label: 'Meine Rechnungen', icon: FileText },
          { href: '/dashboard/einstellungen/mitgliedschaft', label: 'Mitgliedschaft und Zahlungsart', icon: CreditCard },
        ]
      : []),
  ]

  return (
    <nav className="space-y-1">
      {items.map((item) => {
        const active = pathname === item.href
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg text-sm font-semibold ${
              active ? 'bg-brand/10 text-brand' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <item.icon size={16} /> {item.label}
          </Link>
        )
      })}
    </nav>
  )
}

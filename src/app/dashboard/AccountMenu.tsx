'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronDown, User, Settings, LifeBuoy, LogOut, ShieldCheck } from 'lucide-react'

export default function AccountMenu({
  companyName,
  isAdmin,
}: {
  companyName: string
  isAdmin: boolean
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/')
    router.refresh()
  }

  const items = [
    { href: '/dashboard/profil', label: 'Profil', icon: User },
    { href: '/dashboard/einstellungen', label: 'Einstellungen', icon: Settings },
    { href: '/dashboard/support', label: 'Support Center', icon: LifeBuoy },
    ...(isAdmin ? [{ href: '/dashboard/admin', label: 'Admin-Dashboard', icon: ShieldCheck }] : []),
  ]

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 text-sm font-semibold text-slate-700 hover:text-brand"
      >
        <span className="hidden sm:inline">{companyName}</span>
        <ChevronDown size={16} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-56 bg-white border border-slate-200 rounded-xl shadow-lg py-2 z-50">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              <item.icon size={16} className="text-slate-400" /> {item.label}
            </Link>
          ))}
          <div className="border-t border-slate-100 mt-2 pt-2">
            <button
              onClick={handleLogout}
              className="flex items-center gap-2.5 px-4 py-2 text-sm text-red-600 hover:bg-red-50 w-full text-left"
            >
              <LogOut size={16} /> Abmelden
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

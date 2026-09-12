'use client'

import { useRouter } from 'next/navigation'

export default function LogoutButton() {
  const router = useRouter()

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/')
    router.refresh()
  }

  return (
    <button onClick={handleLogout} className="text-sm font-semibold text-slate-500 hover:text-red-600">
      Abmelden
    </button>
  )
}

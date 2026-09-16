import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/current-user'
import EinstellungenNav from './EinstellungenNav'

export default async function EinstellungenLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  return (
    <div>
      <h1 className="text-2xl font-black text-slate-900 mb-6">Einstellungen</h1>
      <div className="grid md:grid-cols-[240px_1fr] gap-8">
        <EinstellungenNav showBilling={user.role === 'subunternehmer'} />
        <div>{children}</div>
      </div>
    </div>
  )
}

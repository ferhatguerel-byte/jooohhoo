import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/current-user'

export default async function DashboardIndex() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  redirect(user.role === 'auftraggeber' ? '/dashboard/auftraege' : '/dashboard/jobs')
}

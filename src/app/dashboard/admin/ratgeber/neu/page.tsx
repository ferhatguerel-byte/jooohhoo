import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/current-user'
import ArticleForm from '../ArticleForm'

export default async function NeuerArtikelPage() {
  const user = await getCurrentUser()
  const adminEmail = process.env.ADMIN_EMAIL
  if (!user) redirect('/login')
  if (!adminEmail || user.email !== adminEmail) redirect('/dashboard')

  return (
    <div>
      <h1 className="text-2xl font-black text-slate-900 mb-6">Neuer Ratgeber-Artikel</h1>
      <ArticleForm />
    </div>
  )
}

import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/current-user'
import { EmailForm, PasswordForm, NotificationsForm, DirectoryListingForm } from './AccountForms'

export default async function KontoEinstellungenPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  return (
    <div className="space-y-8 max-w-lg">
      <section className="bg-white border border-slate-200 rounded-2xl p-6">
        <h2 className="font-bold text-slate-900 mb-4">E-Mail-Adresse</h2>
        <EmailForm currentEmail={user.email} />
      </section>

      <section className="bg-white border border-slate-200 rounded-2xl p-6">
        <h2 className="font-bold text-slate-900 mb-4">Passwort</h2>
        <PasswordForm />
      </section>

      <section className="bg-white border border-slate-200 rounded-2xl p-6">
        <h2 className="font-bold text-slate-900 mb-2">Benachrichtigungen</h2>
        <p className="text-sm text-slate-500 mb-2">Wie und wann wir dich kontaktieren sollen.</p>
        <NotificationsForm
          initialEmailNotifications={user.emailNotifications}
          initialNewsletterOptIn={user.newsletterOptIn}
        />
      </section>

      {user.role === 'subunternehmer' && (
        <section className="bg-white border border-slate-200 rounded-2xl p-6">
          <h2 className="font-bold text-slate-900 mb-2">Branchenbuch</h2>
          <p className="text-sm text-slate-500 mb-2">
            Kostenlos für Ihr Abo enthalten: ein öffentliches, bei Google auffindbares Firmenprofil.
          </p>
          <DirectoryListingForm initialListed={user.directoryListed} />
        </section>
      )}
    </div>
  )
}

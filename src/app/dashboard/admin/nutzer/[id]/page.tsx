import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Paperclip } from 'lucide-react'
import { requireAdmin } from '@/lib/authorization'
import { getDb } from '@/lib/db'
import { TIERS, type TierId } from '@/lib/tiers'
import {
  GewerkeBlockList,
  AccountStatusToggle,
  CancelSubscriptionButton,
  WarningForm,
  NotesForm,
} from './NutzerActions'

export default async function AdminNutzerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await requireAdmin()

  const db = getDb()
  const result = await db.query(
    `SELECT id, company_name, email, phone, plz, ort, gewerke, blocked_gewerke,
            subscription_tier, subscription_status, subscription_committed_until, subscription_cancel_at,
            stripe_subscription_id, verification_status, qualification_files, account_status, admin_notes,
            created_at
     FROM users WHERE id = $1 AND role = 'subunternehmer'`,
    [id]
  )
  if (result.rows.length === 0) notFound()
  const u = result.rows[0]

  const warningsResult = await db.query(
    `SELECT id, message, created_at FROM admin_warnings WHERE user_id = $1 ORDER BY created_at DESC`,
    [id]
  )

  const tier = u.subscription_tier ? TIERS[u.subscription_tier as TierId] : undefined

  const verificationLabels: Record<string, { text: string; className: string }> = {
    unverified: { text: 'Nicht verifiziert', className: 'bg-slate-100 text-slate-500' },
    pending: { text: 'Prüfung läuft', className: 'bg-orange-100 text-orange-700' },
    verified: { text: 'Verifiziert', className: 'bg-blue-100 text-blue-700' },
    rejected: { text: 'Abgelehnt', className: 'bg-red-100 text-red-700' },
  }
  const verification = verificationLabels[u.verification_status] || verificationLabels.unverified

  return (
    <div className="max-w-3xl space-y-6">
      <Link href="/dashboard/admin/nutzer" className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-brand">
        <ArrowLeft size={14} /> Zurück zur Nutzerliste
      </Link>

      <div className="bg-white border border-slate-200 rounded-2xl p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
          <div>
            <h1 className="text-2xl font-black text-slate-900">{u.company_name}</h1>
            <p className="text-sm text-slate-500">{u.email} · {u.phone || 'kein Telefon'}</p>
            <p className="text-sm text-slate-500">{u.plz} {u.ort} · Registriert seit {new Date(u.created_at).toLocaleDateString('de-DE')}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${verification.className}`}>{verification.text}</span>
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${u.account_status === 'suspended' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
              {u.account_status === 'suspended' ? 'Gesperrt' : 'Aktiv'}
            </span>
          </div>
        </div>
        <AccountStatusToggle userId={u.id} status={u.account_status} />
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-6">
        <h2 className="font-bold text-slate-900 mb-3">Gewerke</h2>
        <p className="text-sm text-slate-500 mb-3">
          Ausgewählte Gewerke sind orange, gesperrte rot. Klicken sperrt/entsperrt einzeln.
        </p>
        <GewerkeBlockList userId={u.id} gewerke={u.gewerke || []} blockedGewerke={u.blocked_gewerke || []} />
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-6">
        <h2 className="font-bold text-slate-900 mb-3">Nachweise</h2>
        <div className="flex flex-wrap gap-2">
          {(u.qualification_files || []).map((f: { url: string; name: string; label: string }) => (
            <a
              key={f.url}
              href={f.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-semibold text-brand border border-slate-200 rounded-lg px-3 py-1.5 hover:border-brand/40 flex items-center gap-1"
            >
              <Paperclip size={12} /> {f.label}: {f.name}
            </a>
          ))}
          {(!u.qualification_files || u.qualification_files.length === 0) && (
            <span className="text-sm text-slate-400">Keine Dateien hochgeladen</span>
          )}
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-6">
        <h2 className="font-bold text-slate-900 mb-3">Abo</h2>
        <p className="text-sm text-slate-700 mb-1">
          {tier ? `${tier.name} · ${u.subscription_status}` : 'Kein aktives Abo'}
        </p>
        {u.subscription_committed_until && (
          <p className="text-sm text-slate-500 mb-1">
            Vertragsperiode bis {new Date(u.subscription_committed_until).toLocaleDateString('de-DE')}
          </p>
        )}
        {u.subscription_cancel_at && (
          <p className="text-sm text-orange-600 mb-3">
            Kündigung eingegangen, endet zum {new Date(u.subscription_cancel_at).toLocaleDateString('de-DE')}
          </p>
        )}
        <div className="mt-3">
          <CancelSubscriptionButton userId={u.id} hasSubscription={!!u.stripe_subscription_id && u.subscription_status === 'active'} />
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-6">
        <h2 className="font-bold text-slate-900 mb-3">Mahnung senden</h2>
        <WarningForm userId={u.id} />
        {warningsResult.rows.length > 0 && (
          <div className="mt-4 pt-4 border-t border-slate-100 space-y-2">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Verlauf</p>
            {warningsResult.rows.map((w) => (
              <div key={w.id} className="text-sm bg-orange-50 border border-orange-100 rounded-lg p-3">
                <p className="text-xs text-slate-400 mb-1">{new Date(w.created_at).toLocaleString('de-DE')}</p>
                <p className="text-slate-700 whitespace-pre-wrap">{w.message}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-6">
        <h2 className="font-bold text-slate-900 mb-3">Interne Notizen</h2>
        <NotesForm userId={u.id} initialNotes={u.admin_notes || ''} />
      </div>
    </div>
  )
}

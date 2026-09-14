import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/current-user'
import { getStripe } from '@/lib/stripe'

function formatDate(unixSeconds: number) {
  return new Date(unixSeconds * 1000).toLocaleDateString('de-DE')
}

export default async function RechnungenPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  if (user.role !== 'subunternehmer') redirect('/dashboard')

  let invoices: { id: string; number: string | null; created: number; amount: number; currency: string; status: string; pdfUrl: string | null }[] = []

  if (user.stripeCustomerId && process.env.STRIPE_SECRET_KEY) {
    try {
      const stripe = getStripe()
      const result = await stripe.invoices.list({ customer: user.stripeCustomerId, limit: 24 })
      invoices = result.data.map((inv) => ({
        id: inv.id!,
        number: inv.number,
        created: inv.created,
        amount: inv.total,
        currency: inv.currency,
        status: inv.status || 'draft',
        pdfUrl: inv.invoice_pdf || null,
      }))
    } catch (err) {
      console.error('Rechnungen laden Fehler:', err instanceof Error ? err.message : err)
    }
  }

  const statusLabels: Record<string, { text: string; className: string }> = {
    paid: { text: 'Bezahlt', className: 'bg-green-100 text-green-700' },
    open: { text: 'Offen', className: 'bg-orange-100 text-orange-700' },
    void: { text: 'Storniert', className: 'bg-slate-100 text-slate-500' },
    uncollectible: { text: 'Nicht einziehbar', className: 'bg-red-100 text-red-700' },
    draft: { text: 'Entwurf', className: 'bg-slate-100 text-slate-500' },
  }

  return (
    <div>
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        {invoices.length === 0 ? (
          <p className="text-slate-500 p-6">Noch keine Rechnungen vorhanden.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-left">
              <tr>
                <th className="px-5 py-3 font-semibold">Rechnung</th>
                <th className="px-5 py-3 font-semibold">Datum</th>
                <th className="px-5 py-3 font-semibold">Betrag</th>
                <th className="px-5 py-3 font-semibold">Status</th>
                <th className="px-5 py-3 font-semibold text-right">PDF</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => {
                const status = statusLabels[inv.status] || statusLabels.draft
                return (
                  <tr key={inv.id} className="border-t border-slate-100">
                    <td className="px-5 py-3 font-medium text-slate-800">{inv.number || inv.id.slice(0, 10)}</td>
                    <td className="px-5 py-3 text-slate-500">{formatDate(inv.created)}</td>
                    <td className="px-5 py-3 font-semibold text-slate-800">
                      {(inv.amount / 100).toLocaleString('de-DE', { style: 'currency', currency: inv.currency.toUpperCase() })}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${status.className}`}>{status.text}</span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      {inv.pdfUrl ? (
                        <a href={inv.pdfUrl} target="_blank" rel="noopener noreferrer" className="text-brand font-semibold hover:underline">
                          Herunterladen
                        </a>
                      ) : (
                        <span className="text-slate-300">–</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

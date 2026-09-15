import Link from 'next/link'

export default function NotFoundPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-6">
      <div className="bg-white border border-slate-200 rounded-2xl p-8 max-w-md text-center">
        <div className="text-4xl mb-4">🔍</div>
        <h1 className="text-xl font-black text-slate-900 mb-2">Seite nicht gefunden</h1>
        <p className="text-slate-500 mb-6">
          Die Seite, die Sie suchen, existiert nicht oder wurde verschoben.
        </p>
        <Link href="/" className="bg-brand hover:bg-brand-hover text-white font-bold py-2.5 px-5 rounded-lg inline-block">
          Zur Startseite
        </Link>
      </div>
    </div>
  )
}

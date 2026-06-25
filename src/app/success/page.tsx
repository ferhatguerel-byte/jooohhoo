'use client'

import { useEffect, useState } from 'react'
import { CheckCircle, Copy } from 'lucide-react'

export default function SuccessPage() {
  const [copied, setCopied] = useState(false)
  const [affiliateLink, setAffiliateLink] = useState('')

  useEffect(() => {
    // Affiliate-Link aus localStorage oder einer API holen
    const code = localStorage.getItem('affiliateCode') || 'DEINCODE'
    setAffiliateLink(`${window.location.origin}/?ref=${code}`)
  }, [])

  const copy = () => {
    navigator.clipboard.writeText(affiliateLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-violet-950 to-slate-900 text-white flex items-center justify-center p-6">
      <div className="max-w-lg w-full text-center">
        <div className="flex justify-center mb-6">
          <CheckCircle size={80} className="text-green-400" />
        </div>
        <h1 className="text-4xl font-black mb-4">Zahlung erfolgreich! 🎉</h1>
        <p className="text-slate-300 mb-8">
          Herzlichen Glückwunsch! Dein Account ist jetzt aktiv. Schau in dein E-Mail-Postfach für weitere Details.
        </p>

        <div className="bg-slate-800/50 border border-violet-700 rounded-2xl p-6 mb-6 text-left">
          <h3 className="font-bold text-lg mb-3">💰 Dein Affiliate-Link</h3>
          <p className="text-slate-400 text-sm mb-3">Teile diesen Link und verdiene 30% Provision auf jeden Kauf:</p>
          <div className="flex gap-2">
            <input
              value={affiliateLink}
              readOnly
              className="flex-1 bg-slate-700 rounded-lg px-3 py-2 text-sm text-slate-300 truncate"
            />
            <button
              onClick={copy}
              className="bg-violet-600 hover:bg-violet-500 px-3 py-2 rounded-lg transition-all"
            >
              {copied ? '✓' : <Copy size={16} />}
            </button>
          </div>
        </div>

        <a
          href="/dashboard"
          className="inline-block bg-violet-600 hover:bg-violet-500 text-white font-bold py-3 px-8 rounded-xl transition-all"
        >
          Zum Dashboard →
        </a>
      </div>
    </div>
  )
}

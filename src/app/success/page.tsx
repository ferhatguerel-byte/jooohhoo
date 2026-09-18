'use client'

import { useEffect, useState } from 'react'
import { CheckCircle, Copy, ExternalLink } from 'lucide-react'

export default function SuccessPage() {
  const [copied, setCopied] = useState(false)
  const [affiliateLink, setAffiliateLink] = useState('')
  const [customerEmail, setCustomerEmail] = useState('')

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const email = params.get('email') || ''
    const code = params.get('code') || ''
    setCustomerEmail(email)
    if (code) {
      setAffiliateLink(`${window.location.origin}/?ref=${code}`)
    }
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
        <p className="text-slate-300 mb-2">
          Herzlichen Glückwunsch! Dein Account ist jetzt aktiv.
        </p>
        {customerEmail && (
          <p className="text-slate-400 text-sm mb-8">
            Bestätigung wurde an <strong className="text-white">{customerEmail}</strong> gesendet.
          </p>
        )}

        {affiliateLink && (
          <div className="bg-slate-800/50 border border-violet-700 rounded-2xl p-6 mb-6 text-left">
            <h3 className="font-bold text-lg mb-1">💰 Dein persönlicher Affiliate-Link</h3>
            <p className="text-slate-400 text-sm mb-3">
              Teile diesen Link und verdiene <strong className="text-white">30% Provision</strong> auf jeden Kauf:
            </p>
            <div className="flex gap-2">
              <input
                value={affiliateLink}
                readOnly
                className="flex-1 bg-slate-700 rounded-lg px-3 py-2 text-sm text-slate-300 truncate"
              />
              <button
                onClick={copy}
                className="bg-violet-600 hover:bg-violet-500 px-3 py-2 rounded-lg transition-all"
                title="Kopieren"
              >
                {copied ? '✓' : <Copy size={16} />}
              </button>
            </div>
          </div>
        )}

        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 mb-6 text-left">
          <h3 className="font-bold mb-3">Nächste Schritte</h3>
          <ul className="space-y-2 text-slate-300 text-sm">
            <li>✅ E-Mail Bestätigung in deinem Postfach</li>
            <li>✅ Dein Account ist sofort aktiv</li>
            <li>📬 Onboarding-Guide kommt per E-Mail</li>
          </ul>
        </div>

        <a
          href="/"
          className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white font-bold py-3 px-8 rounded-xl transition-all"
        >
          Zurück zur Startseite <ExternalLink size={16} />
        </a>
      </div>
    </div>
  )
}

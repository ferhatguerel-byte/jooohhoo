'use client'

import { useEffect, useState } from 'react'
import { TrendingUp, Users, Euro, Award } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

interface Stats {
  totalCustomers: number
  totalRevenue: number
  pendingCommissions: number
  revenueByDay: { date: string; amount: number }[]
  planBreakdown: { plan: string; _count: { plan: number } }[]
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [secret, setSecret] = useState('')
  const [authed, setAuthed] = useState(false)
  const [error, setError] = useState('')

  const login = async () => {
    const res = await fetch('/api/admin/stats', {
      headers: { 'x-admin-secret': secret },
    })
    if (res.ok) {
      const data = await res.json()
      setStats(data)
      setAuthed(true)
    } else {
      setError('Falsches Passwort')
    }
  }

  if (!authed) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center">
        <div className="bg-slate-800 rounded-2xl p-8 w-full max-w-sm">
          <h1 className="text-2xl font-black mb-6 text-center">Admin Dashboard</h1>
          <input
            type="password"
            placeholder="Admin Passwort"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && login()}
            className="w-full bg-slate-700 rounded-xl px-4 py-3 mb-4 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
          {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
          <button
            onClick={login}
            className="w-full bg-violet-600 hover:bg-violet-500 text-white font-bold py-3 rounded-xl transition-all"
          >
            Einloggen
          </button>
        </div>
      </div>
    )
  }

  const todayRevenue = stats?.revenueByDay
    .filter(r => r.date === new Date().toISOString().split('T')[0])
    .reduce((sum, r) => sum + r.amount, 0) || 0

  return (
    <div className="min-h-screen bg-slate-900 text-white p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-black mb-8">Admin Dashboard</h1>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { icon: <Euro />, label: 'Heute', value: `€${todayRevenue.toFixed(2)}`, color: 'text-green-400' },
            { icon: <TrendingUp />, label: 'Gesamt Umsatz', value: `€${(stats?.totalRevenue || 0).toFixed(2)}`, color: 'text-violet-400' },
            { icon: <Users />, label: 'Kunden', value: stats?.totalCustomers || 0, color: 'text-blue-400' },
            { icon: <Award />, label: 'Offene Provisionen', value: `€${(stats?.pendingCommissions || 0).toFixed(2)}`, color: 'text-yellow-400' },
          ].map((stat) => (
            <div key={stat.label} className="bg-slate-800 rounded-2xl p-5 border border-slate-700">
              <div className={`${stat.color} mb-2`}>{stat.icon}</div>
              <div className="text-2xl font-black">{stat.value}</div>
              <div className="text-slate-400 text-sm">{stat.label}</div>
            </div>
          ))}
        </div>

        <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700 mb-6">
          <h2 className="text-xl font-bold mb-4">Umsatz (letzte 30 Tage)</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={stats?.revenueByDay || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="date" stroke="#94a3b8" tick={{ fontSize: 12 }} />
              <YAxis stroke="#94a3b8" tick={{ fontSize: 12 }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                labelStyle={{ color: '#e2e8f0' }}
              />
              <Bar dataKey="amount" fill="#7c3aed" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700">
          <h2 className="text-xl font-bold mb-4">Kunden nach Plan</h2>
          <div className="space-y-3">
            {stats?.planBreakdown.map((p) => (
              <div key={p.plan} className="flex justify-between items-center">
                <span className="capitalize text-slate-300">{p.plan}</span>
                <span className="font-bold text-violet-400">{p._count.plan} Kunden</span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6 text-center">
          <p className="text-slate-500 text-sm">
            Ziel: €500/Tag · Heute: €{todayRevenue.toFixed(2)} · {((todayRevenue / 500) * 100).toFixed(1)}% erreicht
          </p>
          <div className="max-w-md mx-auto mt-2 bg-slate-800 rounded-full h-2">
            <div
              className="bg-gradient-to-r from-violet-500 to-green-500 h-2 rounded-full transition-all"
              style={{ width: `${Math.min((todayRevenue / 500) * 100, 100)}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

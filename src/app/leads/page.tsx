'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Search, MapPin, Mail, Phone, Globe, Star, Trash2, Download, Upload,
  Send, FileText, Settings, Plus, RefreshCw, ChevronDown, ChevronUp,
  CheckSquare, Square, X, Filter, BarChart2, Eye, Edit3, Save
} from 'lucide-react'

const GEWERKE = [
  'alle', 'Bauunternehmen', 'Generalunternehmer', 'Hausverwaltung', 'Immobilienverwaltung',
  'Projektentwickler', 'Architekt', 'Bauträger', 'Handwerksbetrieb', 'Malerbetrieb',
  'Dachdecker', 'Trockenbauer', 'Estrichfirma', 'Immobilieninvestor', 'Sanitär', 'Elektriker',
  'Zimmerer', 'Fliesenleger', 'Gerüstbauer', 'Tiefbau', 'Sonstiges',
]

const STATUS_OPTS = ['alle', 'neu', 'kontaktiert', 'interessiert', 'angebot', 'gewonnen', 'verloren']

const STATUS_COLORS: Record<string, string> = {
  neu: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  kontaktiert: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  interessiert: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  angebot: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  gewonnen: 'bg-green-500/20 text-green-300 border-green-500/30',
  verloren: 'bg-red-500/20 text-red-300 border-red-500/30',
}

type Lead = {
  id: string; company_name: string; contact_name: string; email: string; phone: string
  website: string; address: string; city: string; gewerk: string; rating: number
  review_count: number; status: string; source: string; notes: string
  email_sent: number; created_at: string
}

type Stats = {
  total: number; byStatus: { status: string; count: number }[]
  byGewerk: { gewerk: string; count: number }[]; emailsSent: number; recentLeads: number
}

type Tab = 'leads' | 'maps' | 'email' | 'angebot' | 'einstellungen'

const DEFAULT_EMAIL_TEMPLATE = `Betreff: Digitalisierung für {{firma}} – KI-Agenten die Ihre Prozesse automatisieren

Sehr geehrte Damen und Herren,

mein Name ist {{absenderName}} von {{absenderFirma}}.

Ich wende mich an Sie, weil ich Unternehmen aus dem Bereich {{gewerk}} dabei helfe, durch den Einsatz von KI-Agenten mehr Aufträge zu gewinnen und gleichzeitig den Büroaufwand drastisch zu reduzieren.

Unsere KI-Agenten übernehmen für Sie:
✅ Automatische Leadgenerierung & Kundengewinnung
✅ Angebotserstellung in Minuten statt Stunden
✅ E-Mail-Kommunikation & Terminvereinbarungen
✅ CRM-Pflege und Dokumentenmanagement

Viele Unternehmen sparen so 10–20 Stunden pro Woche an Büroarbeit.

Darf ich Ihnen zeigen, wie das für {{firma}} konkret aussehen könnte? Ein kurzes 15-Minuten-Gespräch genügt.

Mit freundlichen Grüßen,
{{absenderName}}
{{absenderFirma}}
{{absenderTel}}
{{absenderEmail}}`

export default function LeadsPage() {
  const [tab, setTab] = useState<Tab>('leads')
  const [leads, setLeads] = useState<Lead[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('alle')
  const [filterGewerk, setFilterGewerk] = useState('alle')
  const [expandedLead, setExpandedLead] = useState<string | null>(null)
  const [editingLead, setEditingLead] = useState<string | null>(null)
  const [editData, setEditData] = useState<Partial<Lead>>({})

  // Maps search state
  const [mapsGewerk, setMapsGewerk] = useState('Bauunternehmen')
  const [mapsCity, setMapsCity] = useState('')
  const [mapsKey, setMapsKey] = useState('')
  const [mapsMax, setMapsMax] = useState(20)
  const [mapsLoading, setMapsLoading] = useState(false)
  const [mapsResult, setMapsResult] = useState<string | null>(null)

  // Email state
  const [emailSubject, setEmailSubject] = useState('Digitalisierung für {{firma}} – KI-Agenten')
  const [emailBody, setEmailBody] = useState(DEFAULT_EMAIL_TEMPLATE.split('\n').slice(1).join('\n').trim())
  const [emailSending, setEmailSending] = useState(false)
  const [emailResult, setEmailResult] = useState<{ ok: number; failed: number } | null>(null)

  // Angebot state
  const [angebotLead, setAngebotLead] = useState('')
  const [angebotLeistungen, setAngebotLeistungen] = useState([
    { bezeichnung: 'KI-Agent Leadgenerierung (monatlich)', menge: 1, einheit: 'Monat', einzelpreis: 299 },
    { bezeichnung: 'Einrichtung & Konfiguration', menge: 1, einheit: 'pauschal', einzelpreis: 499 },
  ])

  // Settings state
  const [settings, setSettings] = useState<Record<string, string>>({})
  const [settingsSaved, setSettingsSaved] = useState(false)

  // CSV import
  const fileRef = useRef<HTMLInputElement>(null)

  const fetchLeads = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ status: filterStatus, gewerk: filterGewerk, search })
    const res = await fetch(`/api/leads?${params}`)
    const data = await res.json()
    setLeads(data.leads || [])
    setStats(data.stats || null)
    setLoading(false)
  }, [filterStatus, filterGewerk, search])

  useEffect(() => { fetchLeads() }, [fetchLeads])

  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then(setSettings)
  }, [])

  const toggleSelect = (id: string) => {
    const s = new Set(selected)
    s.has(id) ? s.delete(id) : s.add(id)
    setSelected(s)
  }

  const toggleAll = () => {
    if (selected.size === leads.length) setSelected(new Set())
    else setSelected(new Set(leads.map(l => l.id)))
  }

  const deleteLead = async (id: string) => {
    await fetch(`/api/leads/${id}`, { method: 'DELETE' })
    fetchLeads()
  }

  const deleteSelected = async () => {
    if (!confirm(`${selected.size} Leads löschen?`)) return
    await Promise.all([...selected].map(id => fetch(`/api/leads/${id}`, { method: 'DELETE' })))
    setSelected(new Set())
    fetchLeads()
  }

  const updateStatus = async (id: string, status: string) => {
    await fetch(`/api/leads/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) })
    fetchLeads()
  }

  const saveLead = async (id: string) => {
    await fetch(`/api/leads/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editData) })
    setEditingLead(null)
    fetchLeads()
  }

  const addManualLead = async () => {
    await fetch('/api/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: 'manuell', status: 'neu' }),
    })
    fetchLeads()
    setTab('leads')
  }

  const searchMaps = async () => {
    if (!mapsCity) { setMapsResult('Bitte Stadt eingeben'); return }
    setMapsLoading(true); setMapsResult(null)
    const res = await fetch('/api/leads/search-maps', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gewerk: mapsGewerk, city: mapsCity, apiKey: mapsKey, maxResults: mapsMax }),
    })
    const data = await res.json()
    if (res.ok) { setMapsResult(`✅ ${data.imported} Leads importiert!`); fetchLeads() }
    else setMapsResult(`❌ Fehler: ${data.error}`)
    setMapsLoading(false)
  }

  const sendEmails = async () => {
    const ids = selected.size > 0 ? [...selected] : leads.filter(l => l.email && !l.email_sent).map(l => l.id)
    if (!ids.length) { alert('Keine Leads zum Senden (oder keine E-Mail-Adresse)'); return }
    if (!confirm(`E-Mail an ${ids.length} Empfänger senden?`)) return
    setEmailSending(true); setEmailResult(null)
    const res = await fetch('/api/leads/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        leadIds: ids, subject: emailSubject, body: emailBody,
        fromName: settings.absender_name, fromEmail: settings.absender_email,
      }),
    })
    const data = await res.json()
    setEmailResult({ ok: data.ok, failed: data.failed })
    setEmailSending(false)
    fetchLeads()
  }

  const exportCSV = () => {
    const params = new URLSearchParams({ status: filterStatus, gewerk: filterGewerk, search })
    window.location.href = `/api/leads/export?${params}`
  }

  const importCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const text = await file.text()
    const res = await fetch('/api/leads/import', { method: 'POST', body: text })
    const data = await res.json()
    alert(`${data.imported} Leads importiert!`)
    fetchLeads()
    e.target.value = ''
  }

  const generateAngebot = async () => {
    const id = angebotLead || (selected.size === 1 ? [...selected][0] : leads[0]?.id)
    if (!id) { alert('Bitte einen Lead auswählen'); return }
    const res = await fetch('/api/leads/offer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        leadId: id, leistungen: angebotLeistungen,
        angebotsDatum: new Date().toLocaleDateString('de-DE'),
        gueltigBis: new Date(Date.now() + 30 * 86400000).toLocaleDateString('de-DE'),
        absenderFirma: settings.absender_firma,
        absenderName: settings.absender_name,
        absenderEmail: settings.absender_email,
        absenderTel: settings.absender_tel,
      }),
    })
    const html = await res.text()
    const w = window.open('', '_blank')
    w?.document.write(html)
    w?.document.close()
  }

  const saveSettings = async () => {
    await fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(settings) })
    setSettingsSaved(true)
    setTimeout(() => setSettingsSaved(false), 2000)
  }

  const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'leads', label: 'Leads', icon: <BarChart2 size={16} /> },
    { key: 'maps', label: 'Google Maps', icon: <MapPin size={16} /> },
    { key: 'email', label: 'E-Mail', icon: <Mail size={16} /> },
    { key: 'angebot', label: 'Angebot', icon: <FileText size={16} /> },
    { key: 'einstellungen', label: 'Einstellungen', icon: <Settings size={16} /> },
  ]

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-100">
      {/* Header */}
      <header className="bg-[#0B1F3A] border-b border-slate-700/50 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-sm font-bold">ML</div>
            <span className="font-bold text-lg tracking-tight">Mail-leads KI</span>
          </div>
          <nav className="flex gap-1">
            {TABS.map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${tab === t.key ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-700/50'}`}
              >
                {t.icon} {t.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">

        {/* LEADS TAB */}
        {tab === 'leads' && (
          <div>
            {/* Stats */}
            {stats && (
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
                {[
                  { label: 'Gesamt', value: stats.total, color: 'text-blue-400' },
                  { label: 'Diese Woche', value: stats.recentLeads, color: 'text-emerald-400' },
                  { label: 'E-Mails gesendet', value: stats.emailsSent, color: 'text-yellow-400' },
                  { label: 'Gewonnen', value: stats.byStatus.find(s => s.status === 'gewonnen')?.count || 0, color: 'text-green-400' },
                  { label: 'In Verhandlung', value: stats.byStatus.find(s => s.status === 'angebot')?.count || 0, color: 'text-orange-400' },
                ].map(s => (
                  <div key={s.label} className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4">
                    <div className={`text-2xl font-black ${s.color}`}>{s.value}</div>
                    <div className="text-slate-400 text-xs mt-0.5">{s.label}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Toolbar */}
            <div className="flex flex-wrap gap-2 mb-4">
              <div className="flex-1 min-w-48 relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  placeholder="Suchen…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
              <select
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
              >
                {STATUS_OPTS.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
              </select>
              <select
                value={filterGewerk}
                onChange={e => setFilterGewerk(e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
              >
                {GEWERKE.map(g => <option key={g} value={g}>{g.charAt(0).toUpperCase() + g.slice(1)}</option>)}
              </select>
              <button onClick={fetchLeads} className="p-2 bg-slate-800 border border-slate-700 rounded-lg hover:bg-slate-700 transition">
                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              </button>
              <button onClick={addManualLead} className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition">
                <Plus size={14} /> Lead
              </button>
              <button onClick={exportCSV} className="flex items-center gap-1.5 px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm transition">
                <Download size={14} /> Export
              </button>
              <button onClick={() => fileRef.current?.click()} className="flex items-center gap-1.5 px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm transition">
                <Upload size={14} /> Import
              </button>
              <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={importCSV} />
            </div>

            {/* Bulk actions */}
            {selected.size > 0 && (
              <div className="flex items-center gap-3 mb-3 px-4 py-2 bg-blue-900/30 border border-blue-700/50 rounded-lg">
                <span className="text-blue-300 text-sm font-medium">{selected.size} ausgewählt</span>
                <button onClick={() => { setTab('email') }} className="flex items-center gap-1 text-sm text-yellow-400 hover:text-yellow-300 transition">
                  <Mail size={14} /> E-Mail senden
                </button>
                <button onClick={() => { setTab('angebot') }} className="flex items-center gap-1 text-sm text-green-400 hover:text-green-300 transition">
                  <FileText size={14} /> Angebot
                </button>
                <button onClick={deleteSelected} className="flex items-center gap-1 text-sm text-red-400 hover:text-red-300 transition ml-auto">
                  <Trash2 size={14} /> Löschen
                </button>
                <button onClick={() => setSelected(new Set())} className="text-slate-400 hover:text-white transition">
                  <X size={14} />
                </button>
              </div>
            )}

            {/* Lead list */}
            <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl overflow-hidden">
              <div className="grid grid-cols-[auto_1fr_auto_auto_auto_auto] gap-0 text-xs text-slate-400 px-4 py-2 border-b border-slate-700/50 font-medium">
                <button onClick={toggleAll} className="mr-3">
                  {selected.size === leads.length && leads.length > 0 ? <CheckSquare size={14} className="text-blue-400" /> : <Square size={14} />}
                </button>
                <span>Firma / Kontakt</span>
                <span className="px-4">Gewerk</span>
                <span className="px-4">Status</span>
                <span className="px-4">Quelle</span>
                <span className="px-2">Aktionen</span>
              </div>

              {loading && (
                <div className="text-center py-12 text-slate-500">
                  <RefreshCw size={24} className="animate-spin mx-auto mb-2" />
                  Laden…
                </div>
              )}

              {!loading && leads.length === 0 && (
                <div className="text-center py-16 text-slate-500">
                  <Filter size={32} className="mx-auto mb-3 opacity-30" />
                  <p className="font-medium">Keine Leads gefunden</p>
                  <p className="text-sm mt-1">Google Maps Suche starten oder manuell hinzufügen</p>
                </div>
              )}

              {leads.map(lead => (
                <div key={lead.id} className={`border-b border-slate-700/30 last:border-0 transition-colors ${expandedLead === lead.id ? 'bg-slate-700/30' : 'hover:bg-slate-700/20'}`}>
                  <div className="grid grid-cols-[auto_1fr_auto_auto_auto_auto] gap-0 items-center px-4 py-3">
                    <button onClick={() => toggleSelect(lead.id)} className="mr-3">
                      {selected.has(lead.id) ? <CheckSquare size={14} className="text-blue-400" /> : <Square size={14} className="text-slate-600" />}
                    </button>

                    <div className="min-w-0">
                      <div className="font-medium text-sm truncate">{lead.company_name || <span className="text-slate-500 italic">Kein Name</span>}</div>
                      <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-400">
                        {lead.city && <span className="flex items-center gap-0.5"><MapPin size={10} />{lead.city}</span>}
                        {lead.email && <span className="flex items-center gap-0.5 text-blue-400"><Mail size={10} />{lead.email}</span>}
                        {lead.phone && <span className="flex items-center gap-0.5"><Phone size={10} />{lead.phone}</span>}
                        {lead.rating && <span className="flex items-center gap-0.5 text-yellow-400"><Star size={10} />{lead.rating}</span>}
                        {lead.email_sent ? <span className="text-green-400 font-medium">✓ gesendet</span> : null}
                      </div>
                    </div>

                    <div className="px-4 text-xs text-slate-300">{lead.gewerk || '—'}</div>

                    <div className="px-4">
                      <select
                        value={lead.status}
                        onChange={e => updateStatus(lead.id, e.target.value)}
                        className={`text-xs px-2 py-1 rounded-full border cursor-pointer bg-transparent font-medium ${STATUS_COLORS[lead.status] || 'text-slate-300'}`}
                      >
                        {STATUS_OPTS.filter(s => s !== 'alle').map(s => <option key={s} value={s} className="bg-slate-800 text-white">{s}</option>)}
                      </select>
                    </div>

                    <div className="px-4 text-xs text-slate-500">{lead.source}</div>

                    <div className="flex items-center gap-1 px-2">
                      <button onClick={() => setExpandedLead(expandedLead === lead.id ? null : lead.id)} className="p-1 hover:text-blue-400 transition text-slate-500">
                        {expandedLead === lead.id ? <ChevronUp size={14} /> : <Eye size={14} />}
                      </button>
                      <button onClick={() => { setEditingLead(lead.id); setEditData(lead); setExpandedLead(lead.id) }} className="p-1 hover:text-yellow-400 transition text-slate-500">
                        <Edit3 size={14} />
                      </button>
                      <button onClick={() => deleteLead(lead.id)} className="p-1 hover:text-red-400 transition text-slate-500">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Expanded detail */}
                  {expandedLead === lead.id && (
                    <div className="px-10 pb-4 border-t border-slate-700/30">
                      {editingLead === lead.id ? (
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-3">
                          {([
                            ['company_name', 'Firma'], ['contact_name', 'Ansprechpartner'], ['email', 'E-Mail'],
                            ['phone', 'Telefon'], ['website', 'Website'], ['address', 'Adresse'],
                            ['city', 'Stadt'], ['gewerk', 'Gewerk'],
                          ] as [keyof Lead, string][]).map(([field, label]) => (
                            <div key={field}>
                              <label className="text-xs text-slate-400 block mb-1">{label}</label>
                              <input
                                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-500"
                                value={String(editData[field] || '')}
                                onChange={e => setEditData(d => ({ ...d, [field]: e.target.value }))}
                              />
                            </div>
                          ))}
                          <div className="col-span-full">
                            <label className="text-xs text-slate-400 block mb-1">Notizen</label>
                            <textarea
                              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-500 resize-none"
                              rows={3}
                              value={String(editData.notes || '')}
                              onChange={e => setEditData(d => ({ ...d, notes: e.target.value }))}
                            />
                          </div>
                          <div className="col-span-full flex gap-2">
                            <button onClick={() => saveLead(lead.id)} className="flex items-center gap-1 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition">
                              <Save size={14} /> Speichern
                            </button>
                            <button onClick={() => setEditingLead(null)} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm transition">
                              Abbrechen
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3 text-sm">
                          {lead.website && <div><span className="text-slate-400 text-xs">Website</span><br /><a href={lead.website} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline flex items-center gap-1"><Globe size={12} />{lead.website}</a></div>}
                          {lead.address && <div><span className="text-slate-400 text-xs">Adresse</span><br />{lead.address}</div>}
                          {lead.review_count && <div><span className="text-slate-400 text-xs">Bewertungen</span><br />{lead.review_count} Rezensionen</div>}
                          {lead.notes && <div className="col-span-full"><span className="text-slate-400 text-xs">Notizen</span><br /><p className="text-slate-300">{lead.notes}</p></div>}
                          <div><span className="text-slate-400 text-xs">Erstellt</span><br />{new Date(lead.created_at).toLocaleDateString('de-DE')}</div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {leads.length > 0 && (
              <p className="text-xs text-slate-500 text-right mt-2">{leads.length} Leads angezeigt</p>
            )}
          </div>
        )}

        {/* GOOGLE MAPS TAB */}
        {tab === 'maps' && (
          <div className="max-w-2xl">
            <h2 className="text-xl font-bold mb-1">Google Maps Lead-Suche</h2>
            <p className="text-slate-400 text-sm mb-6">Suche nach Firmen in deiner Zielgruppe und importiere sie automatisch als Leads.</p>

            <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-6 space-y-4">
              <div>
                <label className="text-sm text-slate-400 block mb-1.5">Google Maps API-Key</label>
                <input
                  type="password"
                  placeholder="AIza..."
                  value={mapsKey}
                  onChange={e => setMapsKey(e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500"
                />
                <p className="text-xs text-slate-500 mt-1">Einmalig eingeben → wird gespeichert. In Google Cloud Console unter "Places API" aktivieren.</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-slate-400 block mb-1.5">Gewerk / Branche</label>
                  <select
                    value={mapsGewerk}
                    onChange={e => setMapsGewerk(e.target.value)}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500"
                  >
                    {GEWERKE.filter(g => g !== 'alle').map(g => <option key={g}>{g}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm text-slate-400 block mb-1.5">Stadt / Region</label>
                  <input
                    placeholder="z.B. Berlin, München, Hamburg"
                    value={mapsCity}
                    onChange={e => setMapsCity(e.target.value)}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm text-slate-400 block mb-1.5">Max. Ergebnisse: {mapsMax}</label>
                <input type="range" min={5} max={60} value={mapsMax} onChange={e => setMapsMax(Number(e.target.value))}
                  className="w-full accent-blue-500" />
              </div>

              <button
                onClick={searchMaps}
                disabled={mapsLoading}
                className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg font-bold flex items-center justify-center gap-2 transition"
              >
                {mapsLoading ? <><RefreshCw size={16} className="animate-spin" /> Suche läuft…</> : <><Search size={16} /> Leads suchen & importieren</>}
              </button>

              {mapsResult && (
                <div className={`px-4 py-3 rounded-lg text-sm font-medium ${mapsResult.startsWith('✅') ? 'bg-green-900/30 text-green-300 border border-green-700/50' : 'bg-red-900/30 text-red-300 border border-red-700/50'}`}>
                  {mapsResult}
                </div>
              )}
            </div>

            <div className="mt-4 bg-slate-800/40 border border-slate-700/30 rounded-xl p-4 text-sm text-slate-400">
              <strong className="text-slate-300 block mb-2">💡 Mehrere Städte durchsuchen:</strong>
              <p>Suche mehrfach mit verschiedenen Städten. Z.B.: "Bauunternehmen Berlin" → "Bauunternehmen Hamburg" → "Bauunternehmen München". Alle Leads landen in deiner Lead-Liste.</p>
            </div>
          </div>
        )}

        {/* EMAIL TAB */}
        {tab === 'email' && (
          <div className="max-w-3xl">
            <h2 className="text-xl font-bold mb-1">E-Mail Kampagne</h2>
            <p className="text-slate-400 text-sm mb-6">
              {selected.size > 0 ? `${selected.size} ausgewählte Leads` : `Alle Leads ohne gesendete E-Mail (${leads.filter(l => l.email && !l.email_sent).length})`} werden angeschrieben.
            </p>

            <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-6 space-y-4">
              <div>
                <label className="text-sm text-slate-400 block mb-1.5">Betreff</label>
                <input
                  value={emailSubject}
                  onChange={e => setEmailSubject(e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-sm text-slate-400">E-Mail Text</label>
                  <span className="text-xs text-slate-500">Variablen: {'{{firma}}'} {'{{gewerk}}'} {'{{stadt}}'} {'{{ansprechpartner}}'} {'{{absenderName}}'} {'{{absenderFirma}}'} {'{{absenderTel}}'} {'{{absenderEmail}}'}</span>
                </div>
                <textarea
                  value={emailBody}
                  onChange={e => setEmailBody(e.target.value)}
                  rows={18}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500 resize-none font-mono"
                />
              </div>

              <button
                onClick={sendEmails}
                disabled={emailSending}
                className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg font-bold flex items-center justify-center gap-2 transition"
              >
                {emailSending ? <><RefreshCw size={16} className="animate-spin" /> Sende…</> : <><Send size={16} /> E-Mails senden</>}
              </button>

              {emailResult && (
                <div className="px-4 py-3 rounded-lg text-sm bg-slate-700/50 border border-slate-600">
                  <span className="text-green-400 font-medium">✅ {emailResult.ok} gesendet</span>
                  {emailResult.failed > 0 && <span className="text-red-400 ml-4">❌ {emailResult.failed} Fehler</span>}
                </div>
              )}
            </div>

            <div className="mt-4 bg-slate-800/40 border border-slate-700/30 rounded-xl p-4 text-sm text-slate-400">
              <strong className="text-slate-300 block mb-2">⚙️ Voraussetzung:</strong>
              <p>Resend API-Key in den Einstellungen hinterlegen. Absender-E-Mail muss in Resend verifiziert sein.</p>
            </div>
          </div>
        )}

        {/* ANGEBOT TAB */}
        {tab === 'angebot' && (
          <div className="max-w-3xl">
            <h2 className="text-xl font-bold mb-1">Angebot erstellen</h2>
            <p className="text-slate-400 text-sm mb-6">Erstelle ein professionelles Angebot als PDF für einen Lead.</p>

            <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-6 space-y-5">
              <div>
                <label className="text-sm text-slate-400 block mb-1.5">Lead / Empfänger</label>
                <select
                  value={angebotLead}
                  onChange={e => setAngebotLead(e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500"
                >
                  <option value="">— Lead auswählen —</option>
                  {leads.map(l => <option key={l.id} value={l.id}>{l.company_name} {l.city ? `(${l.city})` : ''}</option>)}
                </select>
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-sm text-slate-400">Leistungspositionen</label>
                  <button
                    onClick={() => setAngebotLeistungen(l => [...l, { bezeichnung: '', menge: 1, einheit: 'pauschal', einzelpreis: 0 }])}
                    className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition"
                  >
                    <Plus size={12} /> Position hinzufügen
                  </button>
                </div>
                <div className="space-y-2">
                  {angebotLeistungen.map((pos, i) => (
                    <div key={i} className="grid grid-cols-[1fr_80px_80px_100px_auto] gap-2 items-center">
                      <input
                        placeholder="Beschreibung"
                        value={pos.bezeichnung}
                        onChange={e => setAngebotLeistungen(l => l.map((x, j) => j === i ? { ...x, bezeichnung: e.target.value } : x))}
                        className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                      />
                      <input
                        type="number"
                        placeholder="Menge"
                        value={pos.menge}
                        onChange={e => setAngebotLeistungen(l => l.map((x, j) => j === i ? { ...x, menge: Number(e.target.value) } : x))}
                        className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                      />
                      <input
                        placeholder="Einheit"
                        value={pos.einheit}
                        onChange={e => setAngebotLeistungen(l => l.map((x, j) => j === i ? { ...x, einheit: e.target.value } : x))}
                        className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                      />
                      <input
                        type="number"
                        placeholder="€ Preis"
                        value={pos.einzelpreis}
                        onChange={e => setAngebotLeistungen(l => l.map((x, j) => j === i ? { ...x, einzelpreis: Number(e.target.value) } : x))}
                        className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                      />
                      <button onClick={() => setAngebotLeistungen(l => l.filter((_, j) => j !== i))} className="p-2 text-slate-500 hover:text-red-400 transition">
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>

                {angebotLeistungen.length > 0 && (
                  <div className="mt-3 text-right text-sm">
                    <span className="text-slate-400">Netto: </span>
                    <span className="font-bold">{angebotLeistungen.reduce((s, l) => s + l.menge * l.einzelpreis, 0).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}</span>
                    <span className="text-slate-400 ml-4">Brutto (19%): </span>
                    <span className="font-bold text-green-400">{(angebotLeistungen.reduce((s, l) => s + l.menge * l.einzelpreis, 0) * 1.19).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}</span>
                  </div>
                )}
              </div>

              <button
                onClick={generateAngebot}
                className="w-full py-3 bg-blue-600 hover:bg-blue-500 rounded-lg font-bold flex items-center justify-center gap-2 transition"
              >
                <FileText size={16} /> Angebot als PDF öffnen
              </button>
            </div>
          </div>
        )}

        {/* EINSTELLUNGEN TAB */}
        {tab === 'einstellungen' && (
          <div className="max-w-xl">
            <h2 className="text-xl font-bold mb-1">Einstellungen</h2>
            <p className="text-slate-400 text-sm mb-6">API-Keys und Absender-Daten werden lokal in der Datenbank gespeichert.</p>

            <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-6 space-y-5">
              <div>
                <h3 className="font-semibold text-slate-200 mb-3 text-sm uppercase tracking-wider">API-Keys</h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-sm text-slate-400 block mb-1.5">Google Maps API-Key</label>
                    <input
                      type="password"
                      placeholder="AIza… (neu eingeben zum Überschreiben)"
                      value={settings.google_maps_api_key || ''}
                      onChange={e => setSettings(s => ({ ...s, google_maps_api_key: e.target.value }))}
                      className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-slate-400 block mb-1.5">Resend API-Key (für E-Mail-Versand)</label>
                    <input
                      type="password"
                      placeholder="re_… (neu eingeben zum Überschreiben)"
                      value={settings.resend_api_key || ''}
                      onChange={e => setSettings(s => ({ ...s, resend_api_key: e.target.value }))}
                      className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-slate-200 mb-3 text-sm uppercase tracking-wider">Absender-Daten</h3>
                <div className="space-y-3">
                  {([
                    ['absender_firma', 'Firma / Name'],
                    ['absender_name', 'Dein Name'],
                    ['absender_email', 'Absender E-Mail (muss in Resend verifiziert sein)'],
                    ['absender_tel', 'Telefon'],
                  ] as [string, string][]).map(([key, label]) => (
                    <div key={key}>
                      <label className="text-sm text-slate-400 block mb-1.5">{label}</label>
                      <input
                        placeholder={label}
                        value={settings[key] || ''}
                        onChange={e => setSettings(s => ({ ...s, [key]: e.target.value }))}
                        className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <button
                onClick={saveSettings}
                className="w-full py-3 bg-blue-600 hover:bg-blue-500 rounded-lg font-bold flex items-center justify-center gap-2 transition"
              >
                <Save size={16} />
                {settingsSaved ? '✅ Gespeichert!' : 'Einstellungen speichern'}
              </button>
            </div>

            <div className="mt-4 bg-slate-800/40 border border-slate-700/30 rounded-xl p-4 text-sm text-slate-400 space-y-2">
              <p><strong className="text-slate-300">Google Maps API:</strong> console.cloud.google.com → Neues Projekt → Places API aktivieren → API-Key erstellen</p>
              <p><strong className="text-slate-300">Resend API:</strong> resend.com → Kostenloser Account → API-Key → Domain verifizieren (oder onboarding@resend.dev zum Testen)</p>
            </div>
          </div>
        )}

      </main>
    </div>
  )
}

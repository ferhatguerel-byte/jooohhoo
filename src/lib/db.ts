import Database from 'better-sqlite3'
import path from 'path'

const DB_PATH = path.join(process.cwd(), 'data.db')

let _db: Database.Database | null = null

function getDb(): Database.Database {
  if (_db) return _db
  _db = new Database(DB_PATH)
  _db.pragma('journal_mode = WAL')
  initSchema(_db)
  return _db
}

function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT,
      stripe_customer_id TEXT UNIQUE,
      plan TEXT DEFAULT 'free',
      status TEXT DEFAULT 'active',
      affiliate_code TEXT UNIQUE,
      referred_by TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS purchases (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL,
      product_name TEXT,
      amount REAL,
      currency TEXT DEFAULT 'eur',
      stripe_session_id TEXT UNIQUE,
      status TEXT DEFAULT 'pending',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS commissions (
      id TEXT PRIMARY KEY,
      affiliate_id TEXT NOT NULL,
      referred_email TEXT,
      purchase_amount REAL,
      commission_amount REAL,
      status TEXT DEFAULT 'pending',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS revenue (
      id TEXT PRIMARY KEY,
      date TEXT,
      amount REAL,
      source TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS leads (
      id TEXT PRIMARY KEY,
      company_name TEXT,
      contact_name TEXT,
      email TEXT,
      phone TEXT,
      website TEXT,
      address TEXT,
      city TEXT,
      region TEXT,
      gewerk TEXT,
      rating REAL,
      review_count INTEGER,
      source TEXT DEFAULT 'manual',
      status TEXT DEFAULT 'neu',
      notes TEXT,
      email_sent INTEGER DEFAULT 0,
      email_sent_at TEXT,
      maps_place_id TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS email_log (
      id TEXT PRIMARY KEY,
      lead_id TEXT NOT NULL,
      subject TEXT,
      body TEXT,
      sent_at TEXT DEFAULT (datetime('now')),
      status TEXT DEFAULT 'sent'
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `)
}

function uid() {
  return Math.random().toString(36).substring(2) + Date.now().toString(36)
}

export const db = {
  createCustomer(data: {
    email: string; name?: string; stripeCustomerId?: string
    plan?: string; affiliateCode?: string; referredBy?: string
  }) {
    const id = uid()
    const stmt = getDb().prepare(`
      INSERT OR REPLACE INTO customers (id, email, name, stripe_customer_id, plan, affiliate_code, referred_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)
    stmt.run(id, data.email, data.name, data.stripeCustomerId, data.plan || 'starter', data.affiliateCode, data.referredBy)
    return { id, ...data }
  },

  getCustomerByEmail(email: string) {
    return getDb().prepare('SELECT * FROM customers WHERE email = ?').get(email) as Record<string, unknown> | undefined
  },

  getCustomerByAffiliateCode(code: string) {
    return getDb().prepare('SELECT * FROM customers WHERE affiliate_code = ?').get(code) as Record<string, unknown> | undefined
  },

  updateCustomerPlan(stripeCustomerId: string, plan: string, status: string) {
    getDb().prepare('UPDATE customers SET plan = ?, status = ? WHERE stripe_customer_id = ?').run(plan, status, stripeCustomerId)
  },

  createPurchase(data: { customerId: string; productName: string; amount: number; stripeSessionId?: string }) {
    const id = uid()
    getDb().prepare(`
      INSERT INTO purchases (id, customer_id, product_name, amount, stripe_session_id, status)
      VALUES (?, ?, ?, ?, ?, 'completed')
    `).run(id, data.customerId, data.productName, data.amount, data.stripeSessionId)
  },

  createCommission(data: { affiliateId: string; referredEmail: string; purchaseAmount: number; commissionAmount: number }) {
    const id = uid()
    getDb().prepare(`
      INSERT INTO commissions (id, affiliate_id, referred_email, purchase_amount, commission_amount)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, data.affiliateId, data.referredEmail, data.purchaseAmount, data.commissionAmount)
  },

  trackRevenue(date: string, amount: number, source: string) {
    getDb().prepare('INSERT INTO revenue (id, date, amount, source) VALUES (?, ?, ?, ?)').run(uid(), date, amount, source)
  },

  createLead(data: {
    company_name?: string; contact_name?: string; email?: string; phone?: string
    website?: string; address?: string; city?: string; region?: string; gewerk?: string
    rating?: number; review_count?: number; source?: string; status?: string; notes?: string
    maps_place_id?: string
  }) {
    const id = uid()
    getDb().prepare(`
      INSERT OR IGNORE INTO leads (id, company_name, contact_name, email, phone, website, address, city, region, gewerk, rating, review_count, source, status, notes, maps_place_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, data.company_name, data.contact_name, data.email, data.phone, data.website, data.address, data.city, data.region, data.gewerk, data.rating, data.review_count, data.source || 'manuell', data.status || 'neu', data.notes, data.maps_place_id)
    return id
  },

  getLeads(filters?: { status?: string; gewerk?: string; search?: string }) {
    let query = 'SELECT * FROM leads WHERE 1=1'
    const params: unknown[] = []
    if (filters?.status && filters.status !== 'alle') { query += ' AND status = ?'; params.push(filters.status) }
    if (filters?.gewerk && filters.gewerk !== 'alle') { query += ' AND gewerk = ?'; params.push(filters.gewerk) }
    if (filters?.search) { query += ' AND (company_name LIKE ? OR contact_name LIKE ? OR city LIKE ? OR email LIKE ?)'; params.push(`%${filters.search}%`, `%${filters.search}%`, `%${filters.search}%`, `%${filters.search}%`) }
    query += ' ORDER BY created_at DESC'
    return getDb().prepare(query).all(...params) as Record<string, unknown>[]
  },

  getLead(id: string) {
    return getDb().prepare('SELECT * FROM leads WHERE id = ?').get(id) as Record<string, unknown> | undefined
  },

  updateLead(id: string, data: Record<string, unknown>) {
    const allowed = ['status', 'notes', 'contact_name', 'email', 'phone', 'website', 'address', 'gewerk', 'email_sent', 'email_sent_at']
    const filtered = Object.fromEntries(Object.entries(data).filter(([k]) => allowed.includes(k)))
    if (!Object.keys(filtered).length) return
    const fields = Object.keys(filtered).map(k => `${k} = ?`).join(', ')
    const values = Object.values(filtered)
    getDb().prepare(`UPDATE leads SET ${fields}, updated_at = datetime('now') WHERE id = ?`).run(...values, id)
  },

  deleteLead(id: string) {
    getDb().prepare('DELETE FROM leads WHERE id = ?').run(id)
  },

  deleteAllLeads() {
    getDb().prepare('DELETE FROM leads').run()
  },

  logEmail(data: { lead_id: string; subject: string; body: string; status?: string }) {
    const id = uid()
    getDb().prepare('INSERT INTO email_log (id, lead_id, subject, body, status) VALUES (?, ?, ?, ?, ?)').run(id, data.lead_id, data.subject, data.body, data.status || 'sent')
  },

  getEmailLog(lead_id: string) {
    return getDb().prepare('SELECT * FROM email_log WHERE lead_id = ? ORDER BY sent_at DESC').all(lead_id) as Record<string, unknown>[]
  },

  getSetting(key: string) {
    const row = getDb().prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined
    return row?.value
  },

  setSetting(key: string, value: string) {
    getDb().prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value)
  },

  getLeadStats() {
    const db2 = getDb()
    const total = (db2.prepare('SELECT COUNT(*) as c FROM leads').get() as { c: number }).c
    const byStatus = db2.prepare('SELECT status, COUNT(*) as count FROM leads GROUP BY status').all()
    const byGewerk = db2.prepare('SELECT gewerk, COUNT(*) as count FROM leads GROUP BY gewerk ORDER BY count DESC LIMIT 10').all()
    const emailsSent = (db2.prepare('SELECT COUNT(*) as c FROM leads WHERE email_sent = 1').get() as { c: number }).c
    const recentLeads = db2.prepare('SELECT COUNT(*) as c FROM leads WHERE created_at >= datetime("now", "-7 days")').get() as { c: number }
    return { total, byStatus, byGewerk, emailsSent, recentLeads: recentLeads.c }
  },

  getStats() {
    const db2 = getDb()
    const totalCustomers = (db2.prepare('SELECT COUNT(*) as c FROM customers').get() as { c: number }).c
    const totalRevenue = (db2.prepare("SELECT COALESCE(SUM(amount),0) as s FROM purchases WHERE status='completed'").get() as { s: number }).s
    const pendingCommissions = (db2.prepare("SELECT COALESCE(SUM(commission_amount),0) as s FROM commissions WHERE status='pending'").get() as { s: number }).s
    const revenueByDay = db2.prepare('SELECT date, SUM(amount) as amount FROM revenue GROUP BY date ORDER BY date DESC LIMIT 30').all()
    const planBreakdown = db2.prepare('SELECT plan, COUNT(*) as count FROM customers GROUP BY plan').all()
    return { totalCustomers, totalRevenue, pendingCommissions, revenueByDay, planBreakdown }
  },
}

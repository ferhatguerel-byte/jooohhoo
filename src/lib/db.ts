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

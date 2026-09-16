-- BAUVERSUS – Datenbankschema
-- Ausführen mit: psql "$DATABASE_URL" -f src/lib/schema.sql

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('auftraggeber', 'subunternehmer');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE job_status AS ENUM ('open', 'closed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE offer_status AS ENUM ('pending', 'accepted', 'declined');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE subscription_tier AS ENUM ('basic', 'pro', 'premium', 'monthly', 'yearly');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
ALTER TYPE subscription_tier ADD VALUE IF NOT EXISTS 'monthly';
ALTER TYPE subscription_tier ADD VALUE IF NOT EXISTS 'yearly';

DO $$ BEGIN
  CREATE TYPE subscription_status AS ENUM ('inactive', 'active', 'canceled', 'past_due');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE verification_status AS ENUM ('unverified', 'pending', 'verified', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role user_role NOT NULL,
  company_name TEXT NOT NULL,
  phone TEXT,
  plz TEXT,
  ort TEXT,
  gewerke TEXT[] NOT NULL DEFAULT '{}',
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  subscription_tier subscription_tier,
  subscription_status subscription_status NOT NULL DEFAULT 'inactive',
  verification_status verification_status NOT NULL DEFAULT 'unverified',
  qualification_files JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- "Passwort vergessen"-Links (Token wird gehasht gespeichert, nie im Klartext)
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user ON password_reset_tokens(user_id);

CREATE TABLE IF NOT EXISTS jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auftraggeber_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  gewerk TEXT NOT NULL,
  plz TEXT NOT NULL,
  ort TEXT NOT NULL,
  description TEXT NOT NULL,
  budget_min INTEGER,
  budget_max INTEGER,
  deadline DATE,
  status job_status NOT NULL DEFAULT 'open',
  attachments JSONB NOT NULL DEFAULT '[]',
  estimated_cost_min INTEGER,
  estimated_cost_max INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  subunternehmer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  price INTEGER NOT NULL,
  message TEXT,
  status offer_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  viewed_at TIMESTAMPTZ,
  UNIQUE(job_id, subunternehmer_id)
);

-- Solange der Auftraggeber ein Angebot noch nicht angesehen hat, darf der
-- Unternehmer es noch korrigieren.
ALTER TABLE offers ADD COLUMN IF NOT EXISTS viewed_at TIMESTAMPTZ;

-- Auftrag vergeben: welcher Unternehmer hat den Zuschlag erhalten
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS awarded_subunternehmer_id UUID REFERENCES users(id);

-- Bilder/Dateien des Kunden, KI-Kostenschätzung und Verifizierung der Unternehmer
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS attachments JSONB NOT NULL DEFAULT '[]';
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS estimated_cost_min INTEGER;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS estimated_cost_max INTEGER;
ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_status verification_status NOT NULL DEFAULT 'unverified';
ALTER TABLE users ADD COLUMN IF NOT EXISTS qualification_files JSONB NOT NULL DEFAULT '[]';

-- Gegenseitige Bewertungen nach Auftragsabschluss
CREATE TABLE IF NOT EXISTS reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reviewee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(job_id, reviewer_id, reviewee_id)
);

-- Nachrichten zwischen Auftraggeber und Unternehmer zu einem Angebot
CREATE TABLE IF NOT EXISTS offer_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id UUID NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_offer_messages_offer ON offer_messages(offer_id, created_at);

-- Festpreis vs. Preis nach Aufmaß je Angebot
DO $$ BEGIN
  CREATE TYPE pricing_type AS ENUM ('fixed', 'estimate');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE offers ADD COLUMN IF NOT EXISTS pricing_type pricing_type NOT NULL DEFAULT 'estimate';

-- KI-generiertes Leistungsverzeichnis: einzelne Positionen eines Auftrags
CREATE TABLE IF NOT EXISTS job_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  position_order INTEGER NOT NULL DEFAULT 0,
  gewerk TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Preis je Anbieter und Leistungsposition -> macht Angebote direkt vergleichbar
CREATE TABLE IF NOT EXISTS offer_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id UUID NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
  job_line_item_id UUID NOT NULL REFERENCES job_line_items(id) ON DELETE CASCADE,
  price INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(offer_id, job_line_item_id)
);

-- Mindestlaufzeit beim Jahrespaket (monatliche Abbuchung, aber 12 Monate gebunden)
ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_committed_until TIMESTAMPTZ;

-- Vom Kunden erklärte, zum Laufzeitende wirksame Kündigung (Stripe cancel_at)
ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_cancel_at TIMESTAMPTZ;

-- Rate-Limiting für Login/Registrierung/Passwort-Reset gegen Brute-Force und Spam
CREATE TABLE IF NOT EXISTS rate_limit_hits (
  id BIGSERIAL PRIMARY KEY,
  bucket TEXT NOT NULL,
  identifier TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rate_limit_hits_lookup ON rate_limit_hits(bucket, identifier, created_at);

-- Branchenbuch: Unternehmer können ihren öffentlichen Eintrag abschalten
ALTER TABLE users ADD COLUMN IF NOT EXISTS directory_listed BOOLEAN NOT NULL DEFAULT true;

-- Meisterpflichtige Gewerke werden einzeln freigeschaltet, nicht pauschal über
-- verification_status: ein Meisterbrief für Elektro qualifiziert nicht automatisch für Sanitär/Gerüstbau.
ALTER TABLE users ADD COLUMN IF NOT EXISTS verified_gewerke TEXT[] NOT NULL DEFAULT '{}';

-- Ratgeber-Artikel (SEO-Content), vom Admin verwaltet
CREATE TABLE IF NOT EXISTS guide_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  excerpt TEXT NOT NULL,
  content TEXT NOT NULL,
  meta_description TEXT,
  published BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_guide_articles_published ON guide_articles(published, created_at);

-- Generischer Key-Value-Speicher für App-weite Einstellungen (z.B. Stripe-Portal-Konfiguration)
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Admin-Nutzerverwaltung: Kontostatus, gesperrte Gewerke, interne Notizen
DO $$ BEGIN
  CREATE TYPE account_status AS ENUM ('active', 'suspended');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
ALTER TABLE users ADD COLUMN IF NOT EXISTS account_status account_status NOT NULL DEFAULT 'active';
ALTER TABLE users ADD COLUMN IF NOT EXISTS blocked_gewerke TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE users ADD COLUMN IF NOT EXISTS admin_notes TEXT;

CREATE TABLE IF NOT EXISTS admin_warnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_admin_warnings_user ON admin_warnings(user_id, created_at);

-- Benachrichtigungs-Einstellungen des Nutzers
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_notifications BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS newsletter_opt_in BOOLEAN NOT NULL DEFAULT false;

-- Support Center
DO $$ BEGIN
  CREATE TYPE support_ticket_status AS ENUM ('open', 'closed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  subject TEXT NOT NULL,
  status support_ticket_status NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_support_tickets_user ON support_tickets(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status, updated_at);

CREATE TABLE IF NOT EXISTS support_ticket_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  is_admin BOOLEAN NOT NULL DEFAULT false,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_support_ticket_messages_ticket ON support_ticket_messages(ticket_id, created_at);

-- Unternehmer können uninteressante Aufträge aus ihrer eigenen Ansicht ausblenden
CREATE TABLE IF NOT EXISTS hidden_jobs (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  hidden_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, job_id)
);

CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_gewerk ON jobs(gewerk);
CREATE INDEX IF NOT EXISTS idx_offers_job ON offers(job_id);
CREATE INDEX IF NOT EXISTS idx_offers_subunternehmer_month ON offers(subunternehmer_id, created_at);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewee ON reviews(reviewee_id);
CREATE INDEX IF NOT EXISTS idx_job_line_items_job ON job_line_items(job_id);
CREATE INDEX IF NOT EXISTS idx_offer_line_items_offer ON offer_line_items(offer_id);

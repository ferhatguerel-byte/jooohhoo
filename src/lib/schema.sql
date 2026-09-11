-- BauPartner24 – Datenbankschema
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
  CREATE TYPE subscription_tier AS ENUM ('basic', 'pro', 'premium');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE subscription_status AS ENUM ('inactive', 'active', 'canceled', 'past_due');
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
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

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
  UNIQUE(job_id, subunternehmer_id)
);

CREATE TABLE IF NOT EXISTS lead_unlocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auftraggeber_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  offer_id UUID NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(auftraggeber_id, offer_id)
);

-- Auftrag vergeben: welcher Subunternehmer hat den Zuschlag erhalten
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS awarded_subunternehmer_id UUID REFERENCES users(id);

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

CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_gewerk ON jobs(gewerk);
CREATE INDEX IF NOT EXISTS idx_offers_job ON offers(job_id);
CREATE INDEX IF NOT EXISTS idx_lead_unlocks_auftraggeber_month ON lead_unlocks(auftraggeber_id, unlocked_at);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewee ON reviews(reviewee_id);

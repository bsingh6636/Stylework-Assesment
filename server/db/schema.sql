-- Lead Tracker schema (PostgreSQL 13+).
-- Idempotent: safe to run more than once (`npm run db:schema`).

CREATE TABLE IF NOT EXISTS leads (
  -- INTEGER (not BIGINT) so pg returns ids as JS numbers.
  id          INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name        TEXT        NOT NULL CHECK (btrim(name) <> ''),
  email       TEXT        NOT NULL CHECK (btrim(email) <> ''),
  -- Text, not a number: keeps leading zeros, "+" and formatting.
  phone       TEXT        NOT NULL CHECK (btrim(phone) <> ''),
  -- Keep in sync with LEAD_STATUSES in src/leads/lead.types.ts.
  status      TEXT        NOT NULL DEFAULT 'new'
                          CHECK (status IN ('new', 'contacted', 'qualified', 'converted', 'lost')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One lead per email address, ignoring case (Alice@x.com = alice@x.com).
CREATE UNIQUE INDEX IF NOT EXISTS leads_email_lower_key ON leads (lower(email));

-- Leads are listed newest first.
CREATE INDEX IF NOT EXISTS leads_created_at_idx ON leads (created_at DESC);

-- Supabase exposes tables in the public schema through its auto-generated REST
-- API. Enabling row level security with no policies blocks that access, while
-- this server (connecting as the table owner) is unaffected.
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

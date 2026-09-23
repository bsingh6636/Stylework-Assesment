-- Idempotent: safe to run more than once (`npm run db:schema`).

CREATE TABLE IF NOT EXISTS leads (
  -- INTEGER rather than BIGINT, which pg would return as a string.
  id          INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name        TEXT        NOT NULL CHECK (btrim(name) <> ''),
  email       TEXT        NOT NULL CHECK (btrim(email) <> ''),
  phone       TEXT        NOT NULL CHECK (btrim(phone) <> ''),
  -- Keep in sync with LEAD_STATUSES in src/leads/lead.types.ts.
  status      TEXT        NOT NULL DEFAULT 'new'
                          CHECK (status IN ('new', 'contacted', 'qualified', 'converted', 'lost')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS leads_email_lower_key ON leads (lower(email));

CREATE INDEX IF NOT EXISTS leads_created_at_idx ON leads (created_at DESC);

-- Blocks Supabase's auto-generated REST API from reading the table. This server
-- connects as the table owner, which bypasses RLS.
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

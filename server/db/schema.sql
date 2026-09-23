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
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Upgrades tables created before updated_at existed, backfilling it from
-- created_at. Keep this above the trigger, which would stamp the backfill with now().
ALTER TABLE leads ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
UPDATE leads SET updated_at = created_at WHERE updated_at IS NULL;
ALTER TABLE leads
  ALTER COLUMN updated_at SET DEFAULT now(),
  ALTER COLUMN updated_at SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS leads_email_lower_key ON leads (lower(email));

CREATE INDEX IF NOT EXISTS leads_created_at_idx ON leads (created_at DESC);

-- Serves the status filter together with the newest-first sort.
CREATE INDEX IF NOT EXISTS leads_status_created_at_idx ON leads (status, created_at DESC);

-- A trigger rather than application code, so every UPDATE (including ones run
-- from the Supabase dashboard) keeps updated_at accurate.
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER leads_set_updated_at
  BEFORE UPDATE ON leads
  FOR EACH ROW
  WHEN (OLD.* IS DISTINCT FROM NEW.*)
  EXECUTE FUNCTION set_updated_at();

-- Blocks Supabase's auto-generated REST API from reading the table. This server
-- connects as the table owner, which bypasses RLS.
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

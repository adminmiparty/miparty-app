-- Event lifecycle: draft (incomplete / not published) vs active (published / usable).
-- Run in Supabase SQL editor or via CLI. Safe to re-run in part (IF NOT EXISTS / OR clauses).

ALTER TABLE events
ADD COLUMN IF NOT EXISTS status text;

-- Existing rows: treat NULL as published/active (do not downgrade live events).
UPDATE events
SET status = 'active'
WHERE status IS NULL;

ALTER TABLE events
ALTER COLUMN status SET DEFAULT 'draft';

-- Optional: enforce allowed values (drop first if re-running with different definition).
ALTER TABLE events DROP CONSTRAINT IF EXISTS events_status_check;
ALTER TABLE events
ADD CONSTRAINT events_status_check CHECK (status IN ('draft', 'active'));

COMMENT ON COLUMN events.status IS 'Lifecycle: draft = organizer-only borrador; active = published / public-capable.';

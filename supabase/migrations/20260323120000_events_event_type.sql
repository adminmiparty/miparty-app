-- Celebration category for organizer events (cumpleaños, comunión, etc.)
ALTER TABLE events ADD COLUMN IF NOT EXISTS event_type text;

UPDATE events SET event_type = 'cumpleanos' WHERE event_type IS NULL;

ALTER TABLE events DROP CONSTRAINT IF EXISTS events_event_type_check;
ALTER TABLE events
ADD CONSTRAINT events_event_type_check CHECK (
  event_type IS NULL
  OR event_type IN (
    'cumpleanos',
    'comunion',
    'bautizo',
    'reunion_familiar',
    'reunion_amigos',
    'graduacion',
    'otro'
  )
);

COMMENT ON COLUMN events.event_type IS 'Celebration category; NULL legacy rows treated as cumpleanos in app.';

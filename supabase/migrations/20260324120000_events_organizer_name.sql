-- Display name for event organizer contact (shown on invitation recap).
ALTER TABLE events ADD COLUMN IF NOT EXISTS organizer_name text;

COMMENT ON COLUMN events.organizer_name IS 'Organizer contact name shown to guests; phone remains in organizer_phone.';

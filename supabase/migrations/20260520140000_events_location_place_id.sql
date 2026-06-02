-- Google Place ID for locations selected via Places Autocomplete
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS location_place_id text;

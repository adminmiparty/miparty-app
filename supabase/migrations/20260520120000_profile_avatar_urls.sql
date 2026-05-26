-- Custom profile photos for organizer and partner (children already have avatar_url).
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS avatar_url text;

ALTER TABLE public.family_members
  ADD COLUMN IF NOT EXISTS avatar_url text;

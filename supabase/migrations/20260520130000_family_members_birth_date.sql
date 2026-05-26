-- Partner profile birth date (used by dashboard partner modal).
ALTER TABLE public.family_members
  ADD COLUMN IF NOT EXISTS birth_date date;

-- Extend children profiles for "Mi gente" (relation + optional phone).
ALTER TABLE public.children
  ADD COLUMN IF NOT EXISTS relation text,
  ADD COLUMN IF NOT EXISTS phone text;

UPDATE public.children
SET relation = 'hijo'
WHERE relation IS NULL OR trim(relation) = '';

ALTER TABLE public.children
  ALTER COLUMN relation SET DEFAULT 'hijo';

ALTER TABLE public.children
  DROP CONSTRAINT IF EXISTS children_relation_check;

ALTER TABLE public.children
  ADD CONSTRAINT children_relation_check
  CHECK (relation IN ('hijo', 'familiar', 'amigo'));

-- Add denormalized uploader name on notes so student clients can render uploader
-- without requiring cross-profile read access.

ALTER TABLE public.notes
ADD COLUMN IF NOT EXISTS author_name TEXT;

UPDATE public.notes AS n
SET author_name = p.full_name
FROM public.profiles AS p
WHERE n.author_id = p.id
  AND (n.author_name IS NULL OR btrim(n.author_name) = '');

CREATE OR REPLACE FUNCTION public.set_note_author_name()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.author_name IS NULL OR btrim(NEW.author_name) = '' THEN
    SELECT full_name INTO NEW.author_name
    FROM public.profiles
    WHERE id = NEW.author_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_note_author_name_trigger ON public.notes;

CREATE TRIGGER set_note_author_name_trigger
BEFORE INSERT OR UPDATE OF author_id, author_name
ON public.notes
FOR EACH ROW
EXECUTE FUNCTION public.set_note_author_name();

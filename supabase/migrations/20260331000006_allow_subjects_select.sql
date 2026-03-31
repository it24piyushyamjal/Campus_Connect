-- Ensure subjects are readable for attendance workflows.
-- Safe to re-run.

ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "subjects_select_authenticated" ON public.subjects;

CREATE POLICY "subjects_select_authenticated"
ON public.subjects
FOR SELECT
TO authenticated
USING (true);

-- Fix RLS for notes insert and storage uploads in notes bucket.
-- Idempotent migration.

-- Ensure notes insert policy matches frontend behavior (faculty uploads as self author_id).
DROP POLICY IF EXISTS "notes_insert" ON public.notes;

CREATE POLICY "notes_insert"
ON public.notes
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = author_id
  AND EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'faculty'
  )
);

-- Storage policies for notes bucket.
DROP POLICY IF EXISTS "notes_storage_select" ON storage.objects;
DROP POLICY IF EXISTS "notes_storage_insert_faculty" ON storage.objects;
DROP POLICY IF EXISTS "notes_storage_update_faculty" ON storage.objects;
DROP POLICY IF EXISTS "notes_storage_delete_faculty" ON storage.objects;

CREATE POLICY "notes_storage_select"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'notes');

CREATE POLICY "notes_storage_insert_faculty"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'notes'
  AND EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'faculty'
  )
);

CREATE POLICY "notes_storage_update_faculty"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'notes'
  AND EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'faculty'
  )
)
WITH CHECK (
  bucket_id = 'notes'
  AND EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'faculty'
  )
);

CREATE POLICY "notes_storage_delete_faculty"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'notes'
  AND EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'faculty'
  )
);

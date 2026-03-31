-- Fix faculty profile read access by deriving faculty role from public.profiles
-- instead of relying only on JWT custom role claims.

CREATE OR REPLACE FUNCTION public.is_current_user_faculty()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'faculty'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.is_current_user_faculty() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_current_user_faculty() TO authenticated;

DROP POLICY IF EXISTS "profiles_select_faculty" ON public.profiles;

CREATE POLICY "profiles_select_faculty"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.is_current_user_faculty());

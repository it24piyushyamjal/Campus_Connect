-- Fix recursive RLS policy on profiles.
-- Previous policy queried profiles from within profiles SELECT policy, causing
-- "infinite recursion detected in policy for relation profiles".

DROP POLICY IF EXISTS "profiles_select_self_or_faculty" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_self" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_faculty" ON public.profiles;

-- Students can read their own profile row.
CREATE POLICY "profiles_select_self"
ON public.profiles
FOR SELECT
USING (auth.uid() = id);

-- Faculty can read all profiles, based on JWT role metadata.
CREATE POLICY "profiles_select_faculty"
ON public.profiles
FOR SELECT
USING (
  COALESCE(
    auth.jwt() ->> 'role',
    auth.jwt() -> 'app_metadata' ->> 'role'
  ) = 'faculty'
);

-- One-time hotfix for profiles RLS recursion + insecure user_metadata role checks.
-- Safe to run multiple times.

BEGIN;

-- 1) Ensure role/profile trigger uses trusted app metadata for role assignment.
CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  resolved_full_name TEXT;
  resolved_role user_role;
BEGIN
  resolved_full_name := COALESCE(
    NEW.raw_user_meta_data ->> 'full_name',
    split_part(NEW.email, '@', 1),
    'User'
  );

  resolved_role := CASE
    WHEN NEW.raw_app_meta_data ->> 'role' = 'faculty' THEN 'faculty'::user_role
    ELSE 'student'::user_role
  END;

  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (NEW.id, NEW.email, resolved_full_name, resolved_role)
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        full_name = COALESCE(public.profiles.full_name, EXCLUDED.full_name),
        role = COALESCE(public.profiles.role, EXCLUDED.role);

  RETURN NEW;
END;
$$;

-- 2) Rebuild profiles policies from scratch to avoid recursion and remove user_metadata checks.
DO $$
DECLARE
  policy_record RECORD;
BEGIN
  FOR policy_record IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.profiles', policy_record.policyname);
  END LOOP;
END
$$;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_self"
ON public.profiles
FOR SELECT
USING (auth.uid() = id);

CREATE POLICY "profiles_select_faculty"
ON public.profiles
FOR SELECT
USING (
  COALESCE(
    auth.jwt() ->> 'role',
    auth.jwt() -> 'app_metadata' ->> 'role'
  ) = 'faculty'
);

CREATE POLICY "profiles_update_self"
ON public.profiles
FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

COMMIT;

-- Harden profile role derivation by using app_metadata instead of user_metadata.
-- user_metadata is user-editable and must not be trusted for authorization roles.

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

-- Ensure current faculty policy exists and uses trusted JWT app metadata.
DROP POLICY IF EXISTS "profiles_select_faculty" ON public.profiles;

CREATE POLICY "profiles_select_faculty"
ON public.profiles
FOR SELECT
USING (
  COALESCE(
    auth.jwt() ->> 'role',
    auth.jwt() -> 'app_metadata' ->> 'role'
  ) = 'faculty'
);

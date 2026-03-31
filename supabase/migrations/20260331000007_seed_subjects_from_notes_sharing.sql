-- Seed subjects used by Notes Sharing so Attendance can use the same list.
-- Idempotent migration: inserts missing names only.

INSERT INTO public.subjects (name)
SELECT seed.name
FROM (
  VALUES
    ('Data Structures'),
    ('Database Systems'),
    ('Operating Systems'),
    ('Computer Networks'),
    ('Software Engineering')
) AS seed(name)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.subjects s
  WHERE lower(s.name) = lower(seed.name)
);

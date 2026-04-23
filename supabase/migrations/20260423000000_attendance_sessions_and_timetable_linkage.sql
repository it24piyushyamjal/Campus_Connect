-- Attendance sessions architecture + timetable FK linkage
-- Adds normalized session/record tables and upgrades timetable for faculty/class/subject UUID linkage.

CREATE TABLE IF NOT EXISTS public.subjects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subjects_name ON public.subjects(name);

ALTER TABLE public.timetable
  ADD COLUMN IF NOT EXISTS faculty_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS class_id UUID REFERENCES public.classes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_timetable_faculty_id_day ON public.timetable(faculty_id, day);
CREATE INDEX IF NOT EXISTS idx_timetable_class_id_day ON public.timetable(class_id, day);
CREATE INDEX IF NOT EXISTS idx_timetable_subject_id ON public.timetable(subject_id);

INSERT INTO public.subjects (name)
SELECT DISTINCT TRIM(t.subject)
FROM public.timetable t
WHERE t.subject IS NOT NULL
  AND TRIM(t.subject) <> ''
ON CONFLICT (name) DO NOTHING;

UPDATE public.timetable t
SET class_id = c.id
FROM public.classes c
WHERE t.class_id IS NULL
  AND t.class IS NOT NULL
  AND TRIM(t.class) <> ''
  AND c.name = t.class;

UPDATE public.timetable t
SET subject_id = s.id
FROM public.subjects s
WHERE t.subject_id IS NULL
  AND t.subject IS NOT NULL
  AND TRIM(t.subject) <> ''
  AND s.name = t.subject;

UPDATE public.timetable t
SET faculty_id = p.id
FROM public.profiles p
WHERE t.faculty_id IS NULL
  AND t.teacher IS NOT NULL
  AND TRIM(t.teacher) <> ''
  AND p.full_name = t.teacher
  AND p.role = 'faculty';

CREATE TABLE IF NOT EXISTS public.attendance_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  timetable_id UUID NOT NULL REFERENCES public.timetable(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE RESTRICT,
  subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE RESTRICT,
  faculty_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  time_slot TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (timetable_id, date)
);

CREATE INDEX IF NOT EXISTS idx_attendance_sessions_faculty_date
  ON public.attendance_sessions(faculty_id, date);
CREATE INDEX IF NOT EXISTS idx_attendance_sessions_timetable_date
  ON public.attendance_sessions(timetable_id, date);

CREATE TABLE IF NOT EXISTS public.attendance_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES public.attendance_sessions(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('present', 'absent')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (session_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_attendance_records_session_id
  ON public.attendance_records(session_id);
CREATE INDEX IF NOT EXISTS idx_attendance_records_student_id
  ON public.attendance_records(student_id);

CREATE OR REPLACE FUNCTION public.trigger_update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_updated_at_subjects ON public.subjects;
CREATE TRIGGER set_updated_at_subjects
BEFORE UPDATE ON public.subjects
FOR EACH ROW EXECUTE PROCEDURE public.trigger_update_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_attendance_sessions ON public.attendance_sessions;
CREATE TRIGGER set_updated_at_attendance_sessions
BEFORE UPDATE ON public.attendance_sessions
FOR EACH ROW EXECUTE PROCEDURE public.trigger_update_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_attendance_records ON public.attendance_records;
CREATE TRIGGER set_updated_at_attendance_records
BEFORE UPDATE ON public.attendance_records
FOR EACH ROW EXECUTE PROCEDURE public.trigger_update_updated_at();

ALTER TABLE public.class_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'class_students'
      AND policyname = 'class_students_select_self_or_teaching_faculty'
  ) THEN
    CREATE POLICY class_students_select_self_or_teaching_faculty
      ON public.class_students
      FOR SELECT
      USING (
        auth.uid() = student_id
        OR EXISTS (
          SELECT 1
          FROM public.timetable t
          WHERE t.class_id = class_students.class_id
            AND t.faculty_id = auth.uid()
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'attendance_sessions'
      AND policyname = 'attendance_sessions_select_faculty_or_enrolled_student'
  ) THEN
    CREATE POLICY attendance_sessions_select_faculty_or_enrolled_student
      ON public.attendance_sessions
      FOR SELECT
      USING (
        auth.uid() = faculty_id
        OR EXISTS (
          SELECT 1
          FROM public.attendance_records ar
          WHERE ar.session_id = attendance_sessions.id
            AND ar.student_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'attendance_sessions'
      AND policyname = 'attendance_sessions_insert_own_timetable_faculty'
  ) THEN
    CREATE POLICY attendance_sessions_insert_own_timetable_faculty
      ON public.attendance_sessions
      FOR INSERT
      WITH CHECK (
        auth.uid() = faculty_id
        AND EXISTS (
          SELECT 1
          FROM public.timetable t
          WHERE t.id = attendance_sessions.timetable_id
            AND t.faculty_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'attendance_sessions'
      AND policyname = 'attendance_sessions_update_own_timetable_faculty'
  ) THEN
    CREATE POLICY attendance_sessions_update_own_timetable_faculty
      ON public.attendance_sessions
      FOR UPDATE
      USING (
        auth.uid() = faculty_id
        AND EXISTS (
          SELECT 1
          FROM public.timetable t
          WHERE t.id = attendance_sessions.timetable_id
            AND t.faculty_id = auth.uid()
        )
      )
      WITH CHECK (
        auth.uid() = faculty_id
        AND EXISTS (
          SELECT 1
          FROM public.timetable t
          WHERE t.id = attendance_sessions.timetable_id
            AND t.faculty_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'attendance_sessions'
      AND policyname = 'attendance_sessions_delete_own_timetable_faculty'
  ) THEN
    CREATE POLICY attendance_sessions_delete_own_timetable_faculty
      ON public.attendance_sessions
      FOR DELETE
      USING (
        auth.uid() = faculty_id
        AND EXISTS (
          SELECT 1
          FROM public.timetable t
          WHERE t.id = attendance_sessions.timetable_id
            AND t.faculty_id = auth.uid()
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'attendance_records'
      AND policyname = 'attendance_records_select_self_or_faculty'
  ) THEN
    CREATE POLICY attendance_records_select_self_or_faculty
      ON public.attendance_records
      FOR SELECT
      USING (
        auth.uid() = student_id
        OR EXISTS (
          SELECT 1
          FROM public.attendance_sessions s
          WHERE s.id = attendance_records.session_id
            AND s.faculty_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'attendance_records'
      AND policyname = 'attendance_records_insert_own_session_faculty'
  ) THEN
    CREATE POLICY attendance_records_insert_own_session_faculty
      ON public.attendance_records
      FOR INSERT
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.attendance_sessions s
          WHERE s.id = attendance_records.session_id
            AND s.faculty_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'attendance_records'
      AND policyname = 'attendance_records_update_own_session_faculty'
  ) THEN
    CREATE POLICY attendance_records_update_own_session_faculty
      ON public.attendance_records
      FOR UPDATE
      USING (
        EXISTS (
          SELECT 1
          FROM public.attendance_sessions s
          WHERE s.id = attendance_records.session_id
            AND s.faculty_id = auth.uid()
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.attendance_sessions s
          WHERE s.id = attendance_records.session_id
            AND s.faculty_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'attendance_records'
      AND policyname = 'attendance_records_delete_own_session_faculty'
  ) THEN
    CREATE POLICY attendance_records_delete_own_session_faculty
      ON public.attendance_records
      FOR DELETE
      USING (
        EXISTS (
          SELECT 1
          FROM public.attendance_sessions s
          WHERE s.id = attendance_records.session_id
            AND s.faculty_id = auth.uid()
        )
      );
  END IF;
END $$;

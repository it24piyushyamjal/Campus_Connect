-- 2024-03-22 initial schema for CampusConnect

-- UUID extension
do $$ begin
  CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
exception when duplicate_object then null;
end $$;

-- Enum for roles
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE user_role AS ENUM ('student', 'faculty');
  END IF;
END $$;

-- Profiles table (auth.users extension)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  role user_role NOT NULL,
  class TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Classes (for class management/lookup)
CREATE TABLE IF NOT EXISTS classes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Assignments
CREATE TABLE IF NOT EXISTS assignments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  subject TEXT NOT NULL,
  due_date DATE NOT NULL,
  max_marks INT,
  assigned_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  class TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Submissions
CREATE TABLE IF NOT EXISTS submissions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  assignment_id UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  submission_date TIMESTAMPTZ DEFAULT NOW(),
  file_url TEXT,
  marks INT,
  feedback TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(assignment_id, student_id)
);

-- Attendance
CREATE TABLE IF NOT EXISTS attendance (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  date DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('present', 'absent', 'late')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, subject, date)
);

-- Timetable
CREATE TABLE IF NOT EXISTS timetable (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  class TEXT NOT NULL,
  day TEXT NOT NULL,
  time_slot TEXT NOT NULL,
  subject TEXT NOT NULL,
  teacher TEXT,
  room TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notes
CREATE TABLE IF NOT EXISTS notes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  subject TEXT NOT NULL,
  author_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  file_url TEXT,
  tags TEXT[],
  views INT DEFAULT 0,
  rating NUMERIC(3,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Doubts (forum questions)
CREATE TABLE IF NOT EXISTS doubts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  subject TEXT NOT NULL,
  author_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  resolved BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Replies for doubts
CREATE TABLE IF NOT EXISTS replies (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  doubt_id UUID NOT NULL REFERENCES doubts(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Maintenance requests
CREATE TABLE IF NOT EXISTS maintenance_requests (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  requester_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('open', 'in_progress', 'closed')) DEFAULT 'open',
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Fees
CREATE TABLE IF NOT EXISTS fees (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  semester TEXT NOT NULL,
  total_amount NUMERIC(10,2) NOT NULL,
  paid_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('pending', 'paid', 'overdue')) DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Certificates
CREATE TABLE IF NOT EXISTS certificates (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT NOT NULL CHECK (status IN ('requested', 'processing', 'completed', 'rejected')) DEFAULT 'requested',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- helper trigger function
CREATE OR REPLACE FUNCTION trigger_update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_profiles') THEN
    CREATE TRIGGER set_updated_at_profiles BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE PROCEDURE trigger_update_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_assignments') THEN
    CREATE TRIGGER set_updated_at_assignments BEFORE UPDATE ON assignments FOR EACH ROW EXECUTE PROCEDURE trigger_update_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_submissions') THEN
    CREATE TRIGGER set_updated_at_submissions BEFORE UPDATE ON submissions FOR EACH ROW EXECUTE PROCEDURE trigger_update_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_attendance') THEN
    CREATE TRIGGER set_updated_at_attendance BEFORE UPDATE ON attendance FOR EACH ROW EXECUTE PROCEDURE trigger_update_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_timetable') THEN
    CREATE TRIGGER set_updated_at_timetable BEFORE UPDATE ON timetable FOR EACH ROW EXECUTE PROCEDURE trigger_update_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_notes') THEN
    CREATE TRIGGER set_updated_at_notes BEFORE UPDATE ON notes FOR EACH ROW EXECUTE PROCEDURE trigger_update_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_doubts') THEN
    CREATE TRIGGER set_updated_at_doubts BEFORE UPDATE ON doubts FOR EACH ROW EXECUTE PROCEDURE trigger_update_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_replies') THEN
    CREATE TRIGGER set_updated_at_replies BEFORE UPDATE ON replies FOR EACH ROW EXECUTE PROCEDURE trigger_update_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_maintenance_requests') THEN
    CREATE TRIGGER set_updated_at_maintenance_requests BEFORE UPDATE ON maintenance_requests FOR EACH ROW EXECUTE PROCEDURE trigger_update_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_fees') THEN
    CREATE TRIGGER set_updated_at_fees BEFORE UPDATE ON fees FOR EACH ROW EXECUTE PROCEDURE trigger_update_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_certificates') THEN
    CREATE TRIGGER set_updated_at_certificates BEFORE UPDATE ON certificates FOR EACH ROW EXECUTE PROCEDURE trigger_update_updated_at();
  END IF;
END $$;

-- RLS on tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE timetable ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE doubts ENABLE ROW LEVEL SECURITY;
ALTER TABLE replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE fees ENABLE ROW LEVEL SECURITY;
ALTER TABLE certificates ENABLE ROW LEVEL SECURITY;

-- RLS policies
-- profiles
CREATE POLICY "profiles_select_self_or_faculty" ON profiles FOR SELECT USING (
  auth.uid() = id OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'faculty')
);
CREATE POLICY "profiles_update_self" ON profiles FOR UPDATE USING (auth.uid() = id);

-- classes
CREATE POLICY "classes_select" ON classes FOR SELECT USING (true);
CREATE POLICY "classes_manage_faculty" ON classes FOR ALL USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'faculty'));

-- assignments
CREATE POLICY "assignments_select" ON assignments FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND (p.role = 'faculty' OR assignments.class = p.class))
);
CREATE POLICY "assignments_insert_faculty" ON assignments FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'faculty'));
CREATE POLICY "assignments_update_faculty" ON assignments FOR UPDATE USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'faculty'));
CREATE POLICY "assignments_delete_faculty" ON assignments FOR DELETE USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'faculty'));

-- submissions
CREATE POLICY "submissions_select" ON submissions FOR SELECT USING (
  auth.uid() = student_id OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'faculty')
);
CREATE POLICY "submissions_insert" ON submissions FOR INSERT WITH CHECK (auth.uid() = student_id);
CREATE POLICY "submissions_update" ON submissions FOR UPDATE USING (
  auth.uid() = student_id OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'faculty')
);
CREATE POLICY "submissions_delete" ON submissions FOR DELETE USING (
  auth.uid() = student_id OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'faculty')
);

-- attendance
CREATE POLICY "attendance_select" ON attendance FOR SELECT USING (
  auth.uid() = student_id OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'faculty')
);
CREATE POLICY "attendance_insert" ON attendance FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'faculty'));
CREATE POLICY "attendance_update" ON attendance FOR UPDATE USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'faculty'));
CREATE POLICY "attendance_delete" ON attendance FOR DELETE USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'faculty'));

-- timetable
CREATE POLICY "timetable_select" ON timetable FOR SELECT USING (true);
CREATE POLICY "timetable_manage_faculty" ON timetable FOR ALL USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'faculty'));

-- notes
CREATE POLICY "notes_select" ON notes FOR SELECT USING (true);
CREATE POLICY "notes_insert" ON notes FOR INSERT WITH CHECK (auth.uid() = author_id);
CREATE POLICY "notes_update" ON notes FOR UPDATE USING (
  auth.uid() = author_id OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'faculty')
);
CREATE POLICY "notes_delete" ON notes FOR DELETE USING (
  auth.uid() = author_id OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'faculty')
);

-- doubts
CREATE POLICY "doubts_select" ON doubts FOR SELECT USING (true);
CREATE POLICY "doubts_insert" ON doubts FOR INSERT WITH CHECK (auth.uid() = author_id);
CREATE POLICY "doubts_update" ON doubts FOR UPDATE USING (
  auth.uid() = author_id OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'faculty')
);
CREATE POLICY "doubts_delete" ON doubts FOR DELETE USING (
  auth.uid() = author_id OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'faculty')
);

-- replies
CREATE POLICY "replies_select" ON replies FOR SELECT USING (true);
CREATE POLICY "replies_insert" ON replies FOR INSERT WITH CHECK (auth.uid() = author_id);
CREATE POLICY "replies_update" ON replies FOR UPDATE USING (
  auth.uid() = author_id OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'faculty')
);
CREATE POLICY "replies_delete" ON replies FOR DELETE USING (
  auth.uid() = author_id OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'faculty')
);

-- maintenance_requests
CREATE POLICY "maintenance_select" ON maintenance_requests FOR SELECT USING (
  auth.uid() = requester_id OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'faculty')
);
CREATE POLICY "maintenance_insert" ON maintenance_requests FOR INSERT WITH CHECK (auth.uid() = requester_id);
CREATE POLICY "maintenance_update" ON maintenance_requests FOR UPDATE USING (
  auth.uid() = requester_id OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'faculty')
);
CREATE POLICY "maintenance_delete" ON maintenance_requests FOR DELETE USING (
  auth.uid() = requester_id OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'faculty')
);

-- fees
CREATE POLICY "fees_select" ON fees FOR SELECT USING (
  auth.uid() = student_id OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'faculty')
);
CREATE POLICY "fees_insert" ON fees FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'faculty'));
CREATE POLICY "fees_update" ON fees FOR UPDATE USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'faculty'));
CREATE POLICY "fees_delete" ON fees FOR DELETE USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'faculty'));

-- certificates
CREATE POLICY "certificates_select" ON certificates FOR SELECT USING (
  auth.uid() = student_id OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'faculty')
);
CREATE POLICY "certificates_insert" ON certificates FOR INSERT WITH CHECK (auth.uid() = student_id);
CREATE POLICY "certificates_update" ON certificates FOR UPDATE USING (
  auth.uid() = student_id OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'faculty')
);
CREATE POLICY "certificates_delete" ON certificates FOR DELETE USING (
  auth.uid() = student_id OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'faculty')
);

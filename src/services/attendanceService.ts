import { supabase } from '@/lib/supabase';
import type {
  AttendanceRecord,
  AttendanceRecordInsert,
  AttendanceFilters,
  LectureAttendancePayload,
  StudentWithStatus,
} from '@/types/attendance';

interface ProfileRow {
  id: string;
  full_name: string | null;
  email: string | null;
  class?: string | null;
}

class AttendanceServiceError extends Error {
  constructor(
    message: string,
    public code?: string,
  ) {
    super(message);
    this.name = 'AttendanceServiceError';
  }
}

const mapSupabaseError = (error: unknown): string => {
  if (error instanceof Error) {
    if ('code' in error) {
      const code = (error as any).code as string | undefined;
      if (code === '23505') {
        return 'Attendance already marked for this session.';
      }
      if (code === '42501') {
        return "You don't have permission to perform this action.";
      }
    }
    return error.message;
  }
  return 'Something went wrong. Please try again.';
};

const handleError = (error: unknown): never => {
  const message = mapSupabaseError(error);
  throw new AttendanceServiceError(message);
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const isUuid = (value: string): boolean => UUID_REGEX.test(value);

export interface AttendanceIdentifierInput {
  lecture_id?: string | null;
  class_id?: string | null;
  class_name?: string | null;
  subject_id?: string | null;
  subject_name?: string | null;
  faculty_id?: string | null;
}

export interface ResolvedAttendanceIdentifiers {
  class_id: string;
  subject_id: string;
  faculty_id: string;
}

export async function resolveAttendanceIdentifiers(
  input: AttendanceIdentifierInput,
): Promise<ResolvedAttendanceIdentifiers | null> {
  const normalizeText = (value: string | null | undefined): string =>
    (value ?? '').trim().replace(/\s+/g, ' ');

  const resolveIdByName = async (
    table: 'classes' | 'subjects',
    name: string,
  ): Promise<string> => {
    const cleanedName = normalizeText(name);
    if (!cleanedName) return '';

    const exact = await supabase
      .from(table)
      .select('id')
      .eq('name', cleanedName)
      .maybeSingle<{ id: string }>();

    if (exact.error) throw exact.error;
    if (exact.data?.id) return exact.data.id;

    const fuzzy = await supabase
      .from(table)
      .select('id')
      .ilike('name', `%${cleanedName}%`)
      .limit(1);

    if (fuzzy.error) throw fuzzy.error;
    return fuzzy.data?.[0]?.id ?? '';
  };

  const classId = input.class_id?.trim() ?? '';
  const subjectId = input.subject_id?.trim() ?? '';
  const facultyId = input.faculty_id?.trim() ?? '';

  if (!isUuid(facultyId)) {
    return null;
  }

  let resolvedClassId = classId;
  if (!isUuid(resolvedClassId)) {
    const className = normalizeText(input.class_name);
    if (className) {
      resolvedClassId = await resolveIdByName('classes', className);
    }
  }

  let resolvedSubjectId = subjectId;
  if (!isUuid(resolvedSubjectId)) {
    const subjectName = normalizeText(input.subject_name);
    if (subjectName) {
      resolvedSubjectId = await resolveIdByName('subjects', subjectName);
    }
  }

  if ((!isUuid(resolvedClassId) || !isUuid(resolvedSubjectId)) && input.lecture_id?.trim()) {
    const { data: timetableRow, error: timetableError } = await supabase
      .from('timetable')
      .select('class_id, subject_id, class, subject')
      .eq('id', input.lecture_id.trim())
      .maybeSingle<{
        class_id?: string | null;
        subject_id?: string | null;
        class?: string | null;
        subject?: string | null;
      }>();

    if (timetableError) throw timetableError;

    if (!isUuid(resolvedClassId)) {
      const timetableClassId = timetableRow?.class_id?.trim() ?? '';
      if (isUuid(timetableClassId)) {
        resolvedClassId = timetableClassId;
      } else {
        resolvedClassId = await resolveIdByName('classes', normalizeText(timetableRow?.class));
      }
    }

    if (!isUuid(resolvedSubjectId)) {
      const timetableSubjectId = timetableRow?.subject_id?.trim() ?? '';
      if (isUuid(timetableSubjectId)) {
        resolvedSubjectId = timetableSubjectId;
      } else {
        resolvedSubjectId = await resolveIdByName('subjects', normalizeText(timetableRow?.subject));
      }
    }
  }

  if (!isUuid(resolvedClassId) || !isUuid(resolvedSubjectId)) {
    return null;
  }

  return {
    class_id: resolvedClassId,
    subject_id: resolvedSubjectId,
    faculty_id: facultyId,
  };
}

export async function fetchStudentsByClass(class_id: string): Promise<StudentWithStatus[]> {
  try {
    if (!class_id?.trim()) {
      throw new AttendanceServiceError('Class ID is required.');
    }

    const normalizedClassInput = class_id.trim();
    let classNameForQuery = normalizedClassInput;

    // If a UUID is received from lecture, resolve class name first.
    if (isUuid(normalizedClassInput)) {
      const { data: classRow, error: classLookupError } = await supabase
        .from('classes')
        .select('name')
        .eq('id', normalizedClassInput)
        .maybeSingle<{ name: string }>();

      if (classLookupError) throw classLookupError;
      if (!classRow?.name) {
        return [];
      }
      classNameForQuery = classRow.name;
    }

    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, full_name, email, class')
      .eq('role', 'student')
      .eq('class', classNameForQuery)
      .order('full_name', { ascending: true });

    if (profilesError) throw profilesError;

    let matchedProfiles = (profiles as ProfileRow[] | null) ?? [];

    if (matchedProfiles.length === 0) {
      const { data: fallbackProfiles, error: fallbackProfilesError } = await supabase
        .from('profiles')
        .select('id, full_name, email, class')
        .eq('role', 'student')
        .ilike('class', classNameForQuery)
        .order('full_name', { ascending: true });

      if (fallbackProfilesError) throw fallbackProfilesError;
      matchedProfiles = (fallbackProfiles as ProfileRow[] | null) ?? [];
    }

    const mappedStudents = matchedProfiles.map((profile) => {
      return {
        student_id: profile.id,
        full_name: profile?.full_name?.trim() || 'Unknown',
        roll_no: profile?.email || '',
        status: 'absent' as const,
      };
    });

    return mappedStudents;
  } catch (error) {
    handleError(error);
  }
}

export async function fetchExistingAttendance(
  filters: AttendanceFilters,
): Promise<AttendanceRecord[]> {
  try {
    if (
      !filters.class_id?.trim() ||
      !filters.subject_id?.trim() ||
      !filters.date?.trim() ||
      !filters.faculty_id?.trim()
    ) {
      throw new AttendanceServiceError('Class ID, subject ID, date and faculty ID are required.');
    }

    const { data, error } = await supabase
      .from('attendance')
      .select('*')
      .eq('class_id', filters.class_id)
      .eq('subject_id', filters.subject_id)
      .eq('date', filters.date)
      .eq('faculty_id', filters.faculty_id);

    if (error) throw error;

    return (data as AttendanceRecord[]) ?? [];
  } catch (error) {
    handleError(error);
  }
}

export async function submitAttendance(payload: LectureAttendancePayload): Promise<void> {
  try {
    if (!payload.rows.length) {
      throw new AttendanceServiceError('No attendance rows provided.');
    }

    const insertRows: AttendanceRecordInsert[] = payload.rows.map((row) => ({
      student_id: row.student_id,
      faculty_id: payload.faculty_id,
      class_id: payload.class_id,
      subject_id: payload.subject_id,
      date: payload.date,
      status: row.status,
    }));

    const { error: upsertError } = await supabase
      .from('attendance')
      .upsert(insertRows, {
        onConflict: 'student_id,subject_id,date',
      })
      .select('id');

    if (upsertError) throw upsertError;
  } catch (error) {
    handleError(error);
  }
}

export async function fetchStudentAttendanceSummary(): Promise<never> {
  throw new AttendanceServiceError('Student attendance summary is not implemented in this module.');
}

export async function fetchStudentAttendanceHistory(): Promise<never> {
  throw new AttendanceServiceError('Student attendance history is not implemented in this module.');
}

import { supabase } from '@/lib/supabase';
import type {
  AttendanceRecord,
  AttendanceInsert,
  AttendanceFilters,
  StudentWithStatus,
  StudentAttendanceSummary,
} from '@/types/attendance';

// Type definitions for Supabase responses
interface ClassStudentRow {
  student_id: string;
  profiles: { full_name: string } | { full_name: string }[] | null;
}

interface AttendanceSummaryRow {
  subject_id: string;
  status: 'present' | 'absent' | null;
  subjects: { name: string } | null;
}

interface AttendanceHistoryRow extends AttendanceRecord {
  subjects: { name: string } | null;
}

// Custom error class for service layer
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

/**
 * Fetch all students enrolled in a class with their basic info
 * @param class_id - The class ID to fetch students for
 * @returns Array of students with status (initially null)
 * @throws AttendanceServiceError if class_id is invalid or no students found
 */
export async function fetchStudentsByClass(class_id: string): Promise<StudentWithStatus[]> {
  try {
    if (!class_id?.trim()) {
      throw new AttendanceServiceError('Class ID is required.');
    }

    const { data, error } = await supabase
      .from('class_students')
      .select('student_id, profiles(full_name)')
      .eq('class_id', class_id);

    if (error) throw error;

    if (!data || data.length === 0) {
      throw new AttendanceServiceError('No students found for this class.');
    }

    return data.map((row: any) => {
      const profiles = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
      const fullName = profiles?.full_name ?? 'Unknown Student';
      return {
        student_id: row.student_id,
        full_name: fullName,
        status: null,
      };
    });
  } catch (error) {
    handleError(error);
  }
}

/**
 * Submit or update attendance records in batch
 * Uses upsert to handle both new and existing records
 * @param records - Array of attendance records to submit
 * @throws AttendanceServiceError if records array is empty or operation fails
 */
export async function submitAttendance(records: AttendanceInsert[]): Promise<void> {
  try {
    if (!records || records.length === 0) {
      throw new AttendanceServiceError('No attendance records to submit.');
    }

    const { error } = await supabase
      .from('attendance')
      .upsert(records, {
        onConflict: 'student_id,subject_id,date',
      });

    if (error) throw error;
  } catch (error) {
    handleError(error);
  }
}

/**
 * Fetch existing attendance records for specific filters
 * Used to pre-fill UI with previously marked records
 * @param filters - Object containing class_id, subject_id, and date
 * @returns Array of existing attendance records (empty array if none found)
 * @throws AttendanceServiceError if required filters are missing
 */
export async function fetchExistingAttendance(filters: AttendanceFilters): Promise<AttendanceRecord[]> {
  try {
    if (!filters.class_id?.trim() || !filters.subject_id?.trim() || !filters.date?.trim()) {
      throw new AttendanceServiceError('Class ID, subject ID, and date are required.');
    }

    const { data, error } = await supabase
      .from('attendance')
      .select('*')
      .eq('class_id', filters.class_id)
      .eq('subject_id', filters.subject_id)
      .eq('date', filters.date);

    if (error) throw error;

    return (data as AttendanceRecord[]) || [];
  } catch (error) {
    handleError(error);
  }
}

/**
 * Fetch aggregated attendance summary grouped by subject
 * Calculates attendance percentage per subject
 * @param student_id - The student ID to fetch summary for
 * @returns Array of attendance summaries per subject
 * @throws AttendanceServiceError if student_id is invalid or no records found
 */
export async function fetchStudentAttendanceSummary(
  student_id: string,
): Promise<StudentAttendanceSummary[]> {
  try {
    if (!student_id?.trim()) {
      throw new AttendanceServiceError('Student ID is required.');
    }

    const { data, error } = await supabase
      .from('attendance')
      .select('subject_id, status, subjects(name)')
      .eq('student_id', student_id);

    if (error) throw error;

    if (!data || data.length === 0) {
      throw new AttendanceServiceError('No attendance records found for this student.');
    }

    const grouped = data.reduce<Record<string, StudentAttendanceSummary>>((acc, record) => {
      const row = record as unknown as AttendanceSummaryRow;
      const subjectId = row.subject_id;
      const subjectName = row.subjects?.name ?? 'Unknown Subject';

      if (!acc[subjectId]) {
        acc[subjectId] = {
          subject_id: subjectId,
          subject_name: subjectName,
          total_classes: 0,
          present_count: 0,
          absent_count: 0,
          percentage: 0,
        };
      }

      acc[subjectId].total_classes += 1;
      if (row.status === 'present') {
        acc[subjectId].present_count += 1;
      } else if (row.status === 'absent') {
        acc[subjectId].absent_count += 1;
      }

      return acc;
    }, {});

    return Object.values(grouped).map((summary) => ({
      ...summary,
      percentage:
        summary.total_classes > 0
          ? Math.round((summary.present_count / summary.total_classes) * 1000) / 10
          : 0,
    }));
  } catch (error) {
    handleError(error);
  }
}

/**
 * Fetch complete attendance history for a student
 * Includes subject names and ordered by date descending
 * @param student_id - The student ID to fetch history for
 * @returns Array of attendance records with subject details
 * @throws AttendanceServiceError if student_id is invalid
 */
export async function fetchStudentAttendanceHistory(
  student_id: string,
): Promise<(AttendanceRecord & { subject_name: string })[]> {
  try {
    if (!student_id?.trim()) {
      throw new AttendanceServiceError('Student ID is required.');
    }

    const { data, error } = await supabase
      .from('attendance')
      .select('*, subjects(name)')
      .eq('student_id', student_id)
      .order('date', { ascending: false });

    if (error) throw error;

    return (data || []).map((record) => {
      const row = record as unknown as AttendanceHistoryRow;
      return {
        id: row.id,
        student_id: row.student_id,
        faculty_id: row.faculty_id,
        class_id: row.class_id,
        subject_id: row.subject_id,
        date: row.date,
        status: row.status,
        created_at: row.created_at,
        updated_at: row.updated_at,
        subject_name: row.subjects?.name ?? 'Unknown Subject',
      };
    });
  } catch (error) {
    handleError(error);
  }
}

export type AttendanceStatus = 'present' | 'absent';

export type AttendanceRecord = {
  id: string;
  student_id: string;
  faculty_id: string;
  class_id: string;
  subject_id: string;
  date: string;
  status: AttendanceStatus;
  created_at: string;
  updated_at: string;
};

export type AttendanceInsert = Omit<AttendanceRecord, 'id' | 'created_at' | 'updated_at'>;

export type AttendanceFilters = {
  class_id: string;
  subject_id: string;
  date: string;
};

export type StudentWithStatus = {
  student_id: string;
  full_name: string;
  status: AttendanceStatus | null;
};

export type StudentAttendanceSummary = {
  subject_id: string;
  subject_name: string;
  total_classes: number;
  present_count: number;
  absent_count: number;
  percentage: number;
};

export type AttendanceState = {
  selectedClass: string | null;
  selectedSubject: string | null;
  selectedDate: string | null;
  students: StudentWithStatus[];
  attendanceMap: Record<string, AttendanceStatus>;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
};

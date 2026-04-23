export type AttendanceStatus = 'present' | 'absent';

export type AttendanceRecord = {
  id: string;
  student_id: string;
  faculty_id: string;
  class_id: string;
  subject_id: string;
  date: string;
  status: AttendanceStatus;
  created_at?: string;
  updated_at?: string;
};

export type AttendanceRecordInsert = Omit<AttendanceRecord, 'id' | 'created_at' | 'updated_at'>;

export type StudentAttendanceRow = {
  student_id: string;
  full_name: string;
  roll_no: string;
  status: AttendanceStatus;
};

export type LectureAttendancePayload = {
  class_id: string;
  subject_id: string;
  faculty_id: string;
  date: string;
  rows: Array<{
    student_id: string;
    status: AttendanceStatus;
  }>;
};

export type AttendanceFilters = {
  class_id: string;
  subject_id: string;
  date: string;
  faculty_id?: string;
};

export type StudentWithStatus = {
  student_id: string;
  full_name: string;
  roll_no: string;
  status: AttendanceStatus | null;
};

export type AttendanceState = {
  selectedLectureId: string | null;
  selectedDate: string | null;
  students: StudentWithStatus[];
  attendanceMap: Record<string, AttendanceStatus>;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
};

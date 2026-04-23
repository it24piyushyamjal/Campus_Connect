export interface TimetableSlot {
  id: string;
  class: string;
  day: string;
  time_slot: string;
  subject: string;
  teacher: string;
  room: string;
  class_id?: string | null;
  subject_id?: string | null;
  faculty_id?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface FacultyLectureSlot {
  id: string;
  day: string;
  time_slot: string;
  room: string;
  class_id: string;
  class_name: string;
  subject_id: string;
  subject_name: string;
  faculty_id: string;
  is_marked: boolean;
}

export type TimetableInsert = Omit<TimetableSlot, 'id' | 'created_at' | 'updated_at'>;

export type TimetableUpdate = Partial<TimetableInsert> & { id: string };

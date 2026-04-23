import { supabase } from '@/lib/supabase';
import type { TimetableSlot, TimetableInsert, FacultyLectureSlot } from '@/types/timetable';

export const FIXED_TIME_SLOTS = [
  '10:00 - 11:00',
  '11:00 - 12:00',
  '12:00 - 13:00',
  '13:30 - 14:30',
  '14:30 - 15:30',
  '15:30 - 16:30',
  '16:30 - 17:30',
] as const;

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Convert "HH:MM" string to minutes-since-midnight for arithmetic comparison */
function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

/** Returns true when [aStart, aEnd) overlaps with [bStart, bEnd) */
function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  const as = toMinutes(aStart);
  const ae = toMinutes(aEnd);
  const bs = toMinutes(bStart);
  const be = toMinutes(bEnd);
  // Overlap when one starts before the other ends AND the other starts before the first ends
  return as < be && bs < ae;
}

/**
 * Parse a stored time_slot string into { start, end } in "HH:MM" 24-h format.
 * Supports formats: "09:00 - 10:00"  |  "9:00 AM - 10:00 AM"
 */
export function parseTimeSlot(timeSlot: string): { start: string; end: string } | null {
  if (!timeSlot) return null;
  const parts = timeSlot.split('-').map((s) => s.trim());
  if (parts.length < 2) return null;

  const convert = (t: string): string => {
    // Already 24-h format like "09:00"
    if (/^\d{1,2}:\d{2}$/.test(t)) return t.padStart(5, '0');
    // 12-h format like "9:00 AM"
    const match = t.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (!match) return t;
    let h = parseInt(match[1], 10);
    const min = match[2];
    const meridiem = match[3].toUpperCase();
    if (meridiem === 'PM' && h !== 12) h += 12;
    if (meridiem === 'AM' && h === 12) h = 0;
    return `${String(h).padStart(2, '0')}:${min}`;
  };

  return { start: convert(parts[0]), end: convert(parts[1]) };
}

export function normalizeTimeSlot(timeSlot: string): string | null {
  const parsed = parseTimeSlot(timeSlot);
  if (!parsed) return null;
  return `${parsed.start} - ${parsed.end}`;
}

/** Build the canonical "HH:MM - HH:MM" time_slot string stored in DB */
export function buildTimeSlot(start: string, end: string): string {
  return `${start} - ${end}`;
}

function isFixedTimeSlot(timeSlot: string): boolean {
  const normalized = normalizeTimeSlot(timeSlot);
  if (!normalized) return false;
  return FIXED_TIME_SLOTS.includes(normalized as (typeof FIXED_TIME_SLOTS)[number]);
}

// ─── Clash Detection ─────────────────────────────────────────────────────────

export interface ClashInfo {
  type: 'class' | 'faculty' | 'room';
  message: string;
}

interface TimetableLectureRow {
  id: string;
  day: string;
  time_slot: string;
  room: string | null;
  class_id: string | null;
  subject_id: string | null;
  faculty_id: string | null;
  class?: string | null;
  subject?: string | null;
  teacher?: string | null;
}

const isMissingColumnError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const code = (error as { code?: unknown }).code;
  const message = (error as { message?: unknown }).message;
  const details = (error as { details?: unknown }).details;
  const hint = (error as { hint?: unknown }).hint;

  const combinedText = [message, details, hint]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .join(' ')
    .toLowerCase();

  if (typeof code === 'string' && (code === '42703' || code.toUpperCase().startsWith('PGRST'))) {
    return true;
  }

  const mentionsMissingColumn =
    (combinedText.includes('column') && combinedText.includes('does not exist')) ||
    (combinedText.includes('could not find') && combinedText.includes('column')) ||
    (combinedText.includes('schema cache') && combinedText.includes('column'));

  return mentionsMissingColumn;
};

/**
 * Check for scheduling clashes before inserting/updating a slot.
 * Excludes the current slot being edited (identified by class+day+existing time_slot).
 */
export async function checkClashes(
  slot: TimetableInsert,
  /** The original time_slot value of the row being edited — used to exclude self */
  originalTimeSlot?: string,
): Promise<ClashInfo[]> {
  const clashes: ClashInfo[] = [];

  const slotRange = parseTimeSlot(slot.time_slot);
  if (!slotRange) {
    throw new Error('Invalid time slot format.');
  }

  if (!isFixedTimeSlot(slot.time_slot)) {
    throw new Error('Invalid time slot. Only predefined fixed lecture slots are allowed.');
  }

  // Fetch all slots for the same day to compare against
  const { data: daySlots, error } = await supabase
    .from('timetable')
    .select('*')
    .eq('day', slot.day);

  if (error) throw new Error(error.message);
  if (!daySlots || daySlots.length === 0) return [];

  for (const existing of daySlots as TimetableSlot[]) {
    // Skip the slot we are currently editing
    if (
      existing.class === slot.class &&
      existing.time_slot === (originalTimeSlot ?? slot.time_slot)
    ) {
      continue;
    }

    const parsed = parseTimeSlot(existing.time_slot);
    if (!parsed) continue;

    if (!overlaps(slotRange.start, slotRange.end, parsed.start, parsed.end)) continue;

    // A. Class clash
    if (existing.class === slot.class) {
      clashes.push({ type: 'class', message: `Class ${slot.class} already has a lecture at this time (${existing.subject}).` });
    }

    // B. Faculty clash — only check if teacher is set on both
    if (slot.teacher && existing.teacher && existing.teacher === slot.teacher) {
      clashes.push({ type: 'faculty', message: `${slot.teacher} is already assigned to another class at this time.` });
    }

    // C. Room clash — only check if room is set on both
    if (slot.room && existing.room && existing.room.trim() !== '' && existing.room === slot.room) {
      clashes.push({ type: 'room', message: `Room ${slot.room} is already booked at this time.` });
    }
  }

  return clashes;
}

// ─── CRUD ────────────────────────────────────────────────────────────────────

export async function fetchFacultyLectureSlotsByDay(
  facultyId: string,
  day: string,
  date: string,
): Promise<FacultyLectureSlot[]> {
  const normalize = (value: string | null | undefined): string => (value ?? '').toLowerCase().trim();
  const isUuid = (value: unknown): value is string =>
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

  const { data: rows, error } = await supabase
    .from('timetable')
    .select('*')
    .order('time_slot', { ascending: true });

  if (error) throw new Error(error.message);

  const allRows = (rows ?? []) as Array<Record<string, unknown>>;
  const dayRows = allRows.filter(
    (row) => normalize(typeof row.day === 'string' ? row.day : '') === normalize(day),
  );

  const { data: facultyProfile, error: facultyProfileError } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', facultyId)
    .maybeSingle<{ full_name: string | null }>();

  if (facultyProfileError) throw new Error(facultyProfileError.message);

  const teacherName = normalize(facultyProfile?.full_name);
  const facultyRows = dayRows.filter((row) => {
    if (typeof row.faculty_id === 'string' && row.faculty_id === facultyId) {
      return true;
    }
    const legacyTeacher = normalize(typeof row.teacher === 'string' ? row.teacher : '');
    return teacherName.length > 0 && legacyTeacher === teacherName;
  });
  const scopedRows = facultyRows.length > 0 ? facultyRows : dayRows;

  const mappedRows = scopedRows
    .map((row) => ({
      id:
        typeof row.id === 'string' && row.id.trim()
          ? row.id
          : `${String(row.day ?? '')}__${String(row.time_slot ?? '')}__${String(row.class_id ?? row.class ?? '')}__${String(row.subject_id ?? row.subject ?? '')}`,
      day: typeof row.day === 'string' ? row.day : day,
      time_slot: typeof row.time_slot === 'string' ? row.time_slot : '',
      room: typeof row.room === 'string' && row.room.trim() ? row.room : 'TBD',
      class_id: typeof row.class_id === 'string' ? row.class_id : '',
      class_name: typeof row.class === 'string' && row.class.trim()
        ? row.class
        : typeof row.class_name === 'string' && row.class_name.trim()
          ? row.class_name
          : '',
      subject_id: typeof row.subject_id === 'string' ? row.subject_id : '',
      subject_name: typeof row.subject === 'string' && row.subject.trim()
        ? row.subject
        : typeof row.subject_name === 'string' && row.subject_name.trim()
          ? row.subject_name
          : '',
      faculty_id: typeof row.faculty_id === 'string' ? row.faculty_id : facultyId,
    }));

  if (mappedRows.length === 0) {
    return [];
  }

  const classIds = Array.from(new Set(mappedRows.map((row) => row.class_id).filter((id) => isUuid(id))));
  const subjectIds = Array.from(new Set(mappedRows.map((row) => row.subject_id).filter((id) => isUuid(id))));
  const classNames = Array.from(new Set(mappedRows.map((row) => row.class_name).filter((name) => normalize(name).length > 0)));
  const subjectNames = Array.from(new Set(mappedRows.map((row) => row.subject_name).filter((name) => normalize(name).length > 0)));

  const [
    classesByIdResult,
    classesByNameResult,
    subjectsByIdResult,
    subjectsByNameResult,
  ] = await Promise.all([
    classIds.length > 0
      ? supabase.from('classes').select('id, name').in('id', classIds)
      : Promise.resolve({ data: [], error: null }),
    classNames.length > 0
      ? supabase.from('classes').select('id, name').in('name', classNames)
      : Promise.resolve({ data: [], error: null }),
    subjectIds.length > 0
      ? supabase.from('subjects').select('id, name').in('id', subjectIds)
      : Promise.resolve({ data: [], error: null }),
    subjectNames.length > 0
      ? supabase.from('subjects').select('id, name').in('name', subjectNames)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const classError = classesByIdResult.error ?? classesByNameResult.error;
  const subjectError = subjectsByIdResult.error ?? subjectsByNameResult.error;
  if (classError) throw new Error(classError.message);
  if (subjectError) throw new Error(subjectError.message);

  const allClassRows = [...(classesByIdResult.data ?? []), ...(classesByNameResult.data ?? [])];
  const allSubjectRows = [...(subjectsByIdResult.data ?? []), ...(subjectsByNameResult.data ?? [])];
  const classNameById = new Map(allClassRows.map((row) => [row.id, row.name]));
  const classIdByName = new Map(allClassRows.map((row) => [normalize(row.name), row.id]));
  const subjectNameById = new Map(allSubjectRows.map((row) => [row.id, row.name]));
  const subjectIdByName = new Map(allSubjectRows.map((row) => [normalize(row.name), row.id]));

  const finalRows = mappedRows.map((row) => {
    const resolvedClassId = isUuid(row.class_id) ? row.class_id : (classIdByName.get(normalize(row.class_name)) ?? '');
    const resolvedSubjectId = isUuid(row.subject_id) ? row.subject_id : (subjectIdByName.get(normalize(row.subject_name)) ?? '');
    return {
      ...row,
      class_id: resolvedClassId || row.class_id,
      subject_id: resolvedSubjectId || row.subject_id,
    };
  });

  const markableRows = finalRows.filter(
    (row) => isUuid(row.class_id) && isUuid(row.subject_id) && isUuid(row.faculty_id),
  );

  const resolvedClassIds = Array.from(new Set(markableRows.map((row) => row.class_id)));
  const resolvedSubjectIds = Array.from(new Set(markableRows.map((row) => row.subject_id)));

  let markedSet = new Set<string>();
  if (resolvedClassIds.length > 0 && resolvedSubjectIds.length > 0) {
    const { data: attendanceRows, error: attendanceError } = await supabase
      .from('attendance')
      .select('class_id, subject_id')
      .eq('date', date)
      .eq('faculty_id', facultyId)
      .in('class_id', resolvedClassIds)
      .in('subject_id', resolvedSubjectIds);

    if (attendanceError) throw new Error(attendanceError.message);
    markedSet = new Set((attendanceRows ?? []).map((row) => `${row.class_id}__${row.subject_id}`));
  }

  return finalRows.map((row) => ({
    id: row.id,
    day: row.day,
    time_slot: row.time_slot,
    room: row.room,
    class_id: row.class_id,
    class_name: classNameById.get(row.class_id) ?? row.class_name ?? 'Unknown Class',
    subject_id: row.subject_id,
    subject_name: subjectNameById.get(row.subject_id) ?? row.subject_name ?? 'Unknown Subject',
    faculty_id: row.faculty_id,
    is_marked: markedSet.has(`${row.class_id}__${row.subject_id}`),
  }));
}

export async function fetchTimetableByClass(className: string): Promise<TimetableSlot[]> {
  const { data, error } = await supabase
    .from('timetable')
    .select('*')
    .eq('class', className);

  if (error) throw new Error(error.message);
  return data as TimetableSlot[];
}

export async function fetchTimetableByTeacher(teacherName: string): Promise<TimetableSlot[]> {
  const { data, error } = await supabase
    .from('timetable')
    .select('*')
    .eq('teacher', teacherName);

  if (error) throw new Error(error.message);
  return data as TimetableSlot[];
}

export async function saveTimetableSlot(
  slot: TimetableInsert,
  originalTimeSlot?: string,
): Promise<TimetableSlot | null> {
  if (!isFixedTimeSlot(slot.time_slot)) {
    throw new Error('Invalid time slot. Only predefined fixed lecture slots are allowed.');
  }

  const currentLookupTimeSlot = originalTimeSlot ?? slot.time_slot;

  const { data: currentRow, error: currentLookupError } = await supabase
    .from('timetable')
    .select('id')
    .eq('class', slot.class)
    .eq('day', slot.day)
    .eq('time_slot', currentLookupTimeSlot)
    .maybeSingle();

  if (currentLookupError) throw new Error(currentLookupError.message);

  const { data: targetRow, error: targetLookupError } = await supabase
    .from('timetable')
    .select('id')
    .eq('class', slot.class)
    .eq('day', slot.day)
    .eq('time_slot', slot.time_slot)
    .maybeSingle();

  if (targetLookupError) throw new Error(targetLookupError.message);

  if (!slot.subject || slot.subject.trim() === '') {
    if (currentRow) await deleteTimetableSlot(currentRow.id);
    return null;
  }

  let result;

  // Update the original row if we're editing an existing slot
  if (currentRow) {
    const { data, error } = await supabase
      .from('timetable')
      .update({ subject: slot.subject, teacher: slot.teacher, room: slot.room, time_slot: slot.time_slot })
      .eq('id', currentRow.id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    result = data;
  } else if (targetRow) {
    // Fallback for direct edits when original slot isn't provided but target already exists
    const { data, error } = await supabase
      .from('timetable')
      .update({ subject: slot.subject, teacher: slot.teacher, room: slot.room })
      .eq('id', targetRow.id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    result = data;
  } else {
    const { data, error } = await supabase
      .from('timetable')
      .insert([slot])
      .select()
      .single();
    if (error) throw new Error(error.message);
    result = data;
  }

  return result as TimetableSlot;
}

export async function deleteTimetableSlot(id: string): Promise<void> {
  const { error } = await supabase.from('timetable').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function fetchFacultyList(): Promise<{ id: string; full_name: string }[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name')
    .eq('role', 'faculty')
    .order('full_name');

  if (error) throw new Error(error.message);
  return data || [];
}

export async function fetchSubjectList(): Promise<{ id: string; name: string }[]> {
  const { data, error } = await supabase
    .from('subjects')
    .select('id, name')
    .order('name');

  if (error) throw new Error(error.message);
  return data || [];
}

import { useCallback, useRef, useState } from 'react';
import {
  fetchStudentsByClass,
  submitAttendance,
  fetchExistingAttendance,
} from '@/services/attendanceService';
import type {
  StudentWithStatus,
  AttendanceRecord,
  LectureAttendancePayload,
  AttendanceFilters,
} from '@/types/attendance';
import { fetchFacultyLectureSlotsByDay } from '@/services/timetableService';
import type { FacultyLectureSlot } from '@/types/timetable';

interface UseAttendanceState {
  lectures: FacultyLectureSlot[];
  students: StudentWithStatus[];
  existingAttendance: AttendanceRecord[];
  loadingLectures: boolean;
  loadingStudents: boolean;
  loadingAttendance: boolean;
  error: string | null;
  success: string | null;
}

interface UseAttendanceActions {
  loadLectures: (facultyId: string, day: string, date: string) => Promise<void>;
  loadStudents: (class_id: string) => Promise<void>;
  markAttendance: (payload: LectureAttendancePayload) => Promise<void>;
  loadExistingAttendance: (filters: AttendanceFilters) => Promise<void>;
  refreshLectures: () => Promise<void>;
  refreshStudents: () => Promise<void>;
  clearError: () => void;
  clearSuccess: () => void;
}

export type UseAttendanceReturn = UseAttendanceState & UseAttendanceActions;

/**
 * Custom hook for managing attendance operations
 * Provides state and functions for loading students, marking attendance, and fetching summaries
 * @returns Object containing state and action functions
 */
export function useAttendance(): UseAttendanceReturn {
  const [lectures, setLectures] = useState<FacultyLectureSlot[]>([]);
  const [students, setStudents] = useState<StudentWithStatus[]>([]);
  const [existingAttendance, setExistingAttendance] = useState<AttendanceRecord[]>([]);
  const [loadingLectures, setLoadingLectures] = useState(false);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [loadingAttendance, setLoadingAttendance] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const lastLectureFiltersRef = useRef<{ facultyId: string; day: string; date: string } | null>(null);
  const lastClassIdRef = useRef<string | null>(null);

  const clearError = useCallback(() => setError(null), []);
  const clearSuccess = useCallback(() => setSuccess(null), []);

  const getErrorMessage = useCallback((err: unknown, fallback: string): string => {
    if (err instanceof Error && err.message.trim()) {
      return err.message;
    }
    return fallback;
  }, []);

  const runTask = useCallback(
    async <T,>(
      task: () => Promise<T>,
      setLoading: (value: boolean) => void,
      onSuccess?: (result: T) => void,
      options?: { fallbackError?: string; successMessage?: string },
    ): Promise<void> => {
      setLoading(true);
      setError(null);

      try {
        const result = await task();
        if (onSuccess) {
          onSuccess(result);
        }
        if (options?.successMessage) {
          setSuccess(options.successMessage);
        }
      } catch (err) {
        setError(getErrorMessage(err, options?.fallbackError ?? 'Something went wrong.'));
      } finally {
        setLoading(false);
      }
    },
    [getErrorMessage],
  );

  const loadLectures = useCallback(
    async (facultyId: string, day: string, date: string): Promise<void> => {
      lastLectureFiltersRef.current = { facultyId, day, date };
      setSuccess(null);

      await runTask(
        () => fetchFacultyLectureSlotsByDay(facultyId, day, date),
        setLoadingLectures,
        (data) => setLectures(data),
        { fallbackError: 'Failed to load lecture slots.' },
      );
    },
    [runTask],
  );

  const loadStudents = useCallback(
    async (class_id: string): Promise<void> => {
      lastClassIdRef.current = class_id;
      setSuccess(null);

      await runTask(
        () => fetchStudentsByClass(class_id),
        setLoadingStudents,
        (data) => setStudents(data),
        { fallbackError: 'Failed to load students', successMessage: 'Students loaded successfully' },
      );
    },
    [runTask],
  );

  /**
   * Submit attendance records (insert or update)
   */
  const markAttendance = useCallback(
    async (payload: LectureAttendancePayload): Promise<void> => {
      setLoadingAttendance(true);
      setError(null);
      setSuccess(null);

      try {
        await submitAttendance(payload);
        setSuccess('Attendance saved successfully');
      } catch (err) {
        setError(getErrorMessage(err, 'Failed to mark attendance'));
        throw err;
      } finally {
        setLoadingAttendance(false);
      }
    },
    [getErrorMessage],
  );

  /**
   * Load existing attendance records for pre-filling UI
   */
  const loadExistingAttendance = useCallback(
    async (filters: AttendanceFilters): Promise<void> => {
      setExistingAttendance([]);
      await runTask(
        () => fetchExistingAttendance(filters),
        setLoadingAttendance,
        (data) => setExistingAttendance(data),
        { fallbackError: 'Failed to load attendance' },
      );
    },
    [runTask],
  );

  const refreshLectures = useCallback(async (): Promise<void> => {
    if (!lastLectureFiltersRef.current) {
      setError('No lecture filters selected to refresh.');
      return;
    }
    await loadLectures(
      lastLectureFiltersRef.current.facultyId,
      lastLectureFiltersRef.current.day,
      lastLectureFiltersRef.current.date,
    );
  }, [loadLectures]);

  const refreshStudents = useCallback(async (): Promise<void> => {
    if (!lastClassIdRef.current) {
      setError('No class selected to refresh students.');
      return;
    }
    await loadStudents(lastClassIdRef.current);
  }, [loadStudents]);

  return {
    lectures,
    students,
    existingAttendance,
    loadingLectures,
    loadingStudents,
    loadingAttendance,
    error,
    success,
    loadLectures,
    loadStudents,
    markAttendance,
    loadExistingAttendance,
    refreshLectures,
    refreshStudents,
    clearError,
    clearSuccess,
  };
}

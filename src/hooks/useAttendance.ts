import { useCallback, useRef, useState } from 'react';
import {
  fetchStudentsByClass,
  submitAttendance,
  fetchExistingAttendance,
  fetchStudentAttendanceSummary,
  fetchStudentAttendanceHistory,
} from '@/services/attendanceService';
import type {
  StudentWithStatus,
  AttendanceRecord,
  AttendanceInsert,
  AttendanceFilters,
  StudentAttendanceSummary,
} from '@/types/attendance';

interface UseAttendanceState {
  students: StudentWithStatus[];
  existingAttendance: AttendanceRecord[];
  attendanceSummary: StudentAttendanceSummary[];
  attendanceHistory: (AttendanceRecord & { subject_name: string })[];
  loadingStudents: boolean;
  loadingAttendance: boolean;
  loadingSummary: boolean;
  loadingHistory: boolean;
  error: string | null;
  success: string | null;
}

interface UseAttendanceActions {
  loadStudents: (class_id: string) => Promise<void>;
  markAttendance: (records: AttendanceInsert[]) => Promise<void>;
  loadExistingAttendance: (filters: AttendanceFilters) => Promise<void>;
  loadStudentSummary: (student_id: string) => Promise<void>;
  loadStudentHistory: (student_id: string) => Promise<void>;
  refreshStudents: () => Promise<void>;
  refreshSummary: () => Promise<void>;
  refreshHistory: () => Promise<void>;
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
  const [students, setStudents] = useState<StudentWithStatus[]>([]);
  const [existingAttendance, setExistingAttendance] = useState<AttendanceRecord[]>([]);
  const [attendanceSummary, setAttendanceSummary] = useState<StudentAttendanceSummary[]>([]);
  const [attendanceHistory, setAttendanceHistory] = useState<
    (AttendanceRecord & { subject_name: string })[]
  >([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [loadingAttendance, setLoadingAttendance] = useState(false);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const lastClassIdRef = useRef<string | null>(null);
  const lastSummaryStudentIdRef = useRef<string | null>(null);
  const lastHistoryStudentIdRef = useRef<string | null>(null);

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

  /**
   * Load all students for a given class
   */
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
    async (records: AttendanceInsert[]): Promise<void> => {
      setSuccess(null);

      await runTask(
        () => submitAttendance(records),
        setLoadingAttendance,
        undefined,
        {
          fallbackError: 'Failed to mark attendance',
          successMessage: 'Attendance marked successfully',
        },
      );
    },
    [runTask],
  );

  /**
   * Load existing attendance records for pre-filling UI
   */
  const loadExistingAttendance = useCallback(
    async (filters: AttendanceFilters): Promise<void> => {
      await runTask(
        () => fetchExistingAttendance(filters),
        setLoadingAttendance,
        (data) => setExistingAttendance(data),
        { fallbackError: 'Failed to load attendance' },
      );
    },
    [runTask],
  );

  /**
   * Load attendance summary for a student (grouped by subject)
   */
  const loadStudentSummary = useCallback(
    async (student_id: string): Promise<void> => {
      lastSummaryStudentIdRef.current = student_id;

      await runTask(
        () => fetchStudentAttendanceSummary(student_id),
        setLoadingSummary,
        (data) => setAttendanceSummary(data),
        { fallbackError: 'Failed to load summary' },
      );
    },
    [runTask],
  );

  /**
   * Load full attendance history for a student (ordered by date)
   */
  const loadStudentHistory = useCallback(
    async (student_id: string): Promise<void> => {
      lastHistoryStudentIdRef.current = student_id;

      await runTask(
        () => fetchStudentAttendanceHistory(student_id),
        setLoadingHistory,
        (data) => setAttendanceHistory(data),
        { fallbackError: 'Failed to load history' },
      );
    },
    [runTask],
  );

  const refreshStudents = useCallback(async (): Promise<void> => {
    if (!lastClassIdRef.current) {
      setError('No class selected to refresh students.');
      return;
    }
    await loadStudents(lastClassIdRef.current);
  }, [loadStudents]);

  const refreshSummary = useCallback(async (): Promise<void> => {
    if (!lastSummaryStudentIdRef.current) {
      setError('No student selected to refresh summary.');
      return;
    }
    await loadStudentSummary(lastSummaryStudentIdRef.current);
  }, [loadStudentSummary]);

  const refreshHistory = useCallback(async (): Promise<void> => {
    if (!lastHistoryStudentIdRef.current) {
      setError('No student selected to refresh history.');
      return;
    }
    await loadStudentHistory(lastHistoryStudentIdRef.current);
  }, [loadStudentHistory]);

  return {
    students,
    existingAttendance,
    attendanceSummary,
    attendanceHistory,
    loadingStudents,
    loadingAttendance,
    loadingSummary,
    loadingHistory,
    error,
    success,
    loadStudents,
    markAttendance,
    loadExistingAttendance,
    loadStudentSummary,
    loadStudentHistory,
    refreshStudents,
    refreshSummary,
    refreshHistory,
    clearError,
    clearSuccess,
  };
}

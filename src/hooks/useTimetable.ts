import { useState, useCallback } from 'react';
import {
  fetchTimetableByClass,
  fetchTimetableByTeacher,
  saveTimetableSlot,
  fetchFacultyList,
  fetchSubjectList,
  checkClashes,
} from '@/services/timetableService';
import type { ClashInfo } from '@/services/timetableService';
import type { TimetableSlot, TimetableInsert } from '@/types/timetable';
import { useToast } from '@/hooks/use-toast';

export type { ClashInfo };

export function useTimetable() {
  const [timetableData, setTimetableData] = useState<TimetableSlot[]>([]);
  const [facultyList, setFacultyList] = useState<{ id: string; full_name: string }[]>([]);
  const [subjectList, setSubjectList] = useState<{ id: string; name: string }[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const loadDropdownData = useCallback(async () => {
    try {
      const [faculties, subjects] = await Promise.all([fetchFacultyList(), fetchSubjectList()]);
      setFacultyList(faculties);
      setSubjectList(subjects);
    } catch (err: any) {
      console.error('Failed to load dropdown options:', err);
      toast({ title: 'Error loading options', description: 'Failed to load faculty and subject lists.', variant: 'destructive' });
    }
  }, [toast]);

  const loadClassTimetable = useCallback(async (className: string) => {
    if (!className) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchTimetableByClass(className);
      setTimetableData(data);
    } catch (err: any) {
      setError(err.message);
      toast({ title: 'Error loading timetable', description: err.message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const loadTeacherTimetable = useCallback(async (teacherName: string) => {
    if (!teacherName) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchTimetableByTeacher(teacherName);
      setTimetableData(data);
    } catch (err: any) {
      setError(err.message);
      toast({ title: 'Error loading timetable', description: err.message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  /**
   * Validate clashes then save. Returns array of ClashInfo if clashes found (save is blocked).
   * Throws on network/DB errors.
   */
  const validateAndSaveSlot = useCallback(
    async (
      slot: TimetableInsert,
      originalTimeSlot?: string,
    ): Promise<ClashInfo[]> => {
      // Run clash detection first
      const clashes = await checkClashes(slot, originalTimeSlot);
      if (clashes.length > 0) return clashes;

      // No clashes — persist
      const updatedSlot = await saveTimetableSlot(slot, originalTimeSlot);

      setTimetableData((prev) => {
        // Remove old entry (matched by original time_slot or current)
        const removeKey = originalTimeSlot ?? slot.time_slot;
        const filtered = prev.filter(
          (s) => !(s.class === slot.class && s.day === slot.day && s.time_slot === removeKey),
        );
        return updatedSlot ? [...filtered, updatedSlot] : filtered;
      });

      return [];
    },
    [],
  );

  return {
    timetableData,
    facultyList,
    subjectList,
    isLoading,
    error,
    loadClassTimetable,
    loadTeacherTimetable,
    validateAndSaveSlot,
    loadDropdownData,
  };
}

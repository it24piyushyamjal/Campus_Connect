import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useAttendance } from '@/hooks/useAttendance';
import type { AttendanceStatus } from '@/types/attendance';
import type { FacultyLectureSlot } from '@/types/timetable';
import { resolveAttendanceIdentifiers } from '@/services/attendanceService';
import { Check, Clock3, Loader2, Search, Users, X } from 'lucide-react';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;
const toLocalISODate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getDateForWeekdayThisWeek = (targetDayName: string): string => {
  const current = new Date();
  const currentDayIndex = current.getDay();
  const dayIndices: Record<string, number> = {
    Sunday: 0,
    Monday: 1,
    Tuesday: 2,
    Wednesday: 3,
    Thursday: 4,
    Friday: 5,
    Saturday: 6,
  };

  const targetIndex = dayIndices[targetDayName] ?? currentDayIndex;
  const diff = targetIndex - currentDayIndex;

  const targetDate = new Date(current);
  targetDate.setDate(current.getDate() + diff);

  return toLocalISODate(targetDate);
};

const formatDayDate = (dateStr: string): string => {
  const localDate = new Date(`${dateStr}T00:00:00`);
  return localDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

export default function Attendance() {
  const { user } = useAuth();
  const [activeDay, setActiveDay] = useState<string>('Monday');
  const [selectedLecture, setSelectedLecture] = useState<FacultyLectureSlot | null>(null);
  const [search, setSearch] = useState('');
  const [attendanceMap, setAttendanceMap] = useState<Record<string, AttendanceStatus>>({});
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const {
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
  } = useAttendance();

  const selectedDate = useMemo(() => getDateForWeekdayThisWeek(activeDay), [activeDay]);
  const currentLectures = useMemo(() => {
    return lectures.filter((lecture) => (lecture.day || '').toLowerCase() === activeDay.toLowerCase());
  }, [lectures, activeDay]);

  useEffect(() => {
    const todayIndex = new Date().getDay();
    if (todayIndex >= 1 && todayIndex <= 6) {
      setActiveDay(DAYS[todayIndex - 1]);
    }
  }, []);

  useEffect(() => {
    if (!user?.id || user.role !== 'faculty') {
      return;
    }

    void loadLectures(user.id, activeDay, selectedDate);
  }, [user?.id, user?.role, activeDay, selectedDate, loadLectures]);

  useEffect(() => {
    if (!selectedLecture) {
      return;
    }

    const existingMap = existingAttendance.reduce<Record<string, AttendanceStatus>>((acc, row) => {
      acc[row.student_id] = row.status;
      return acc;
    }, {});

    const nextMap = students.reduce<Record<string, AttendanceStatus>>((acc, student) => {
      acc[student.student_id] = existingMap[student.student_id] ?? 'present';
      return acc;
    }, {});

    setAttendanceMap(nextMap);
  }, [selectedLecture, students, existingAttendance]);

  const filteredStudents = useMemo(() => {
    const query = search.toLowerCase().trim();
    if (!query) {
      return students;
    }

    return students.filter((student) => {
      return (
        student.full_name.toLowerCase().includes(query) || student.roll_no.toLowerCase().includes(query)
      );
    });
  }, [students, search]);

  const presentCount = useMemo(() => {
    return Object.values(attendanceMap).filter((status) => status === 'present').length;
  }, [attendanceMap]);

  const handleLectureClick = async (lecture: FacultyLectureSlot) => {
    if (!user?.id) {
      return;
    }

    const classLookupValue = lecture.class_id?.trim() || lecture.class_name?.trim();
    if (!classLookupValue) {
      console.error('Missing class identifier for lecture', lecture);
      return;
    }

    setSearch('');
    setSelectedLecture(lecture);
    setModalLoading(true);
    setModalError(null);

    try {
      await loadStudents(classLookupValue);

      let resolvedIds = null;
      try {
        resolvedIds = await resolveAttendanceIdentifiers({
          lecture_id: lecture.id,
          class_id: lecture.class_id,
          class_name: lecture.class_name,
          subject_id: lecture.subject_id,
          subject_name: lecture.subject_name,
          faculty_id: user.id,
        });
      } catch (resolveError) {
        console.error('Failed to resolve attendance identifiers for prefill', resolveError);
      }

      if (resolvedIds) {
        await loadExistingAttendance({
          class_id: resolvedIds.class_id,
          subject_id: resolvedIds.subject_id,
          date: selectedDate,
          faculty_id: resolvedIds.faculty_id,
        });
      } else {
        console.error('Skipping existing attendance prefill due to invalid UUIDs', {
          class_id: lecture.class_id,
          subject_id: lecture.subject_id,
          faculty_id: user.id,
        });
      }
    } catch (loadError) {
      console.error('Failed to load attendance modal data', loadError);
      setModalError('Failed to load students for this lecture.');
    } finally {
      setModalLoading(false);
    }
  };

  const handleMarkAll = (status: AttendanceStatus) => {
    setAttendanceMap((previous) => {
      const next = { ...previous };
      filteredStudents.forEach((student) => {
        next[student.student_id] = status;
      });
      return next;
    });
  };

  const toggleStudent = (studentId: string, status: AttendanceStatus) => {
    setAttendanceMap((previous) => ({
      ...previous,
      [studentId]: status,
    }));
  };

  const handleSaveAttendance = async () => {
    if (!selectedLecture || !user?.id) {
      return;
    }

    try {
      setModalError(null);

      const resolvedIds = await resolveAttendanceIdentifiers({
        lecture_id: selectedLecture.id,
        class_id: selectedLecture.class_id,
        class_name: selectedLecture.class_name,
        subject_id: selectedLecture.subject_id,
        subject_name: selectedLecture.subject_name,
        faculty_id: user.id,
      });

      if (!resolvedIds) {
        setModalError('Unable to map class/subject IDs for this lecture.');
        return;
      }

      const rows = students.map((student) => ({
        student_id: student.student_id,
        status: attendanceMap[student.student_id] ?? 'present',
      }));

      await markAttendance({
        class_id: resolvedIds.class_id,
        subject_id: resolvedIds.subject_id,
        faculty_id: resolvedIds.faculty_id,
        date: selectedDate,
        rows,
      });

      await Promise.all([
        loadExistingAttendance({
          class_id: resolvedIds.class_id,
          subject_id: resolvedIds.subject_id,
          date: selectedDate,
          faculty_id: resolvedIds.faculty_id,
        }),
        loadLectures(user.id, activeDay, selectedDate),
      ]);

      setSelectedLecture(null);
    } catch (saveError) {
      console.error('Failed to submit attendance', saveError);
      const message =
        saveError instanceof Error && saveError.message.trim()
          ? saveError.message
          : 'Failed to submit attendance. Please try again.';
      setModalError(message);
    }
  };

  if (!user || user.role !== 'faculty') {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Attendance Module</CardTitle>
        </CardHeader>
        <CardContent className="text-muted-foreground">
          Faculty access is required to mark attendance.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Attendance</h1>
        <p className="text-muted-foreground">Select a lecture and mark attendance from live roster data.</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-2">
            {DAYS.map((day) => {
              const isActive = activeDay === day;
              return (
                <Button
                  key={day}
                  variant={isActive ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setActiveDay(day)}
                >
                  {day}
                </Button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {error && (
        <Card>
          <CardContent className="py-4 text-destructive">{error}</CardContent>
        </Card>
      )}

      {success && (
        <Card>
          <CardContent className="py-4 text-emerald-600">{success}</CardContent>
        </Card>
      )}

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">{activeDay}'s Lectures</h2>
        <span className="text-xs font-semibold text-muted-foreground">{formatDayDate(selectedDate)}</span>
      </div>

      {loadingLectures ? (
        <Card>
          <CardContent className="py-10 flex justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </CardContent>
        </Card>
      ) : currentLectures.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">No lectures found for this day.</CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {currentLectures.map((lecture) => (
            <button
              key={lecture.id}
              onClick={() => void handleLectureClick(lecture)}
              className={`text-left rounded-lg border p-4 transition-colors ${
                lecture.is_marked ? 'border-emerald-300 bg-emerald-50/40' : 'border-border bg-card hover:bg-muted/40'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-semibold text-foreground">{lecture.subject_name}</h3>
                {lecture.is_marked && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2 py-1 text-[11px] font-semibold text-emerald-700">
                    <Check className="h-3 w-3" /> Marked
                  </span>
                )}
              </div>

              <div className="mt-3 space-y-1 text-sm text-muted-foreground">
                <p className="flex items-center gap-2">
                  <Users className="h-4 w-4" /> {lecture.class_name}
                </p>
                <p className="flex items-center gap-2">
                  <Clock3 className="h-4 w-4" /> {lecture.time_slot.replace('-', '–')}
                </p>
                <p className="text-xs">{lecture.room}</p>
              </div>

              <div className="mt-4 border-t pt-3 text-xs font-semibold text-primary">
                {lecture.is_marked ? 'Tap to edit attendance' : 'Tap to mark attendance'}
              </div>
            </button>
          ))}
        </div>
      )}

      {selectedLecture && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center">
          <div className="bg-card w-full sm:max-w-3xl max-h-[90vh] rounded-t-2xl sm:rounded-2xl border shadow-xl flex flex-col">
            <div className="p-4 sm:p-6 border-b flex items-start justify-between gap-3">
              <div>
                <h3 className="text-xl font-bold text-foreground">{selectedLecture.subject_name}</h3>
                <p className="mt-1 text-sm text-muted-foreground flex items-center gap-3">
                  <span>{selectedLecture.class_name}</span>
                  <span>•</span>
                  <span>{selectedLecture.time_slot.replace('-', '–')}</span>
                  <span>•</span>
                  <span>{formatDayDate(selectedDate)}</span>
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setSelectedLecture(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="p-4 sm:p-6 border-b space-y-3">
              {modalError && (
                <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {modalError}
                </div>
              )}
              <div className="relative">
                <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="pl-9"
                  placeholder="Search by name or roll no"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => handleMarkAll('present')}>Mark All Present</Button>
                <Button variant="outline" onClick={() => handleMarkAll('absent')}>Mark All Absent</Button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3 sm:p-4 bg-muted/30">
              {(modalLoading || loadingStudents || loadingAttendance) ? (
                <div className="py-10 flex justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : filteredStudents.length === 0 ? (
                <div className="py-10 text-center text-muted-foreground">No students found.</div>
              ) : (
                <div className="space-y-2">
                  {filteredStudents.map((student) => {
                    const status = attendanceMap[student.student_id] ?? 'present';
                    const isPresent = status === 'present';

                    return (
                      <div
                        key={student.student_id}
                        className="bg-card border rounded-lg p-3 flex items-center justify-between gap-3"
                      >
                        <div>
                          <p className="font-semibold text-foreground">{student.full_name}</p>
                          <p className="text-xs text-muted-foreground">{student.roll_no}</p>
                        </div>

                        <div className="flex items-center rounded-md border p-1 bg-muted/60">
                          <button
                            onClick={() => toggleStudent(student.student_id, 'present')}
                            className={`px-3 py-1.5 text-xs font-semibold rounded ${
                              isPresent ? 'bg-emerald-500 text-white' : 'text-muted-foreground'
                            }`}
                          >
                            P
                          </button>
                          <button
                            onClick={() => toggleStudent(student.student_id, 'absent')}
                            className={`px-3 py-1.5 text-xs font-semibold rounded ${
                              !isPresent ? 'bg-rose-500 text-white' : 'text-muted-foreground'
                            }`}
                          >
                            A
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="p-4 sm:p-6 border-t flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-6 w-full sm:w-auto">
                <div>
                  <p className="text-[11px] uppercase text-muted-foreground font-semibold">Present</p>
                  <p className="text-xl font-bold text-emerald-600">{presentCount}</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase text-muted-foreground font-semibold">Absent</p>
                  <p className="text-xl font-bold text-rose-600">{students.length - presentCount}</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase text-muted-foreground font-semibold">Total</p>
                  <p className="text-xl font-bold text-foreground">{students.length}</p>
                </div>
              </div>

              <Button className="w-full sm:w-auto" onClick={() => void handleSaveAttendance()} disabled={loadingAttendance || students.length === 0}>
                {selectedLecture.is_marked ? 'Update Attendance' : 'Submit Attendance'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { useAttendance } from "@/hooks/useAttendance";
import type { AttendanceStatus, StudentWithStatus } from "@/types/attendance";
import { Loader2 } from "lucide-react";

interface AttendanceSummary {
  id: string;
  subject: string;
  teacher: string;
  totalClasses: number;
  attended: number;
  percentage: number;
  lastAttended: string;
}

interface SubjectOption {
  id: string;
  name: string;
}

export default function Attendance() {
  const { user } = useAuth();
  const [selectedStudentId, setSelectedStudentId] = useState<string>("");
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [studentClassMap, setStudentClassMap] = useState<Record<string, string>>({});
  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [selectedStatus, setSelectedStatus] = useState<AttendanceStatus>("present");
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const [fallbackStudents, setFallbackStudents] = useState<StudentWithStatus[]>([]);
  const {
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
    loadStudentSummary,
    loadStudentHistory,
    loadExistingAttendance,
  } = useAttendance();

  const [currentAttendanceData, setCurrentAttendanceData] = useState<AttendanceSummary[]>([]);
  const displayedStudents = students.length > 0 ? students : fallbackStudents;
  const resolvedClassIdForSelectedStudent =
    selectedClassId ||
    studentClassMap[selectedStudentId] ||
    attendanceHistory[0]?.class_id ||
    "";

  useEffect(() => {
    const loadSubjects = async () => {
      const { data, error: subjectsError } = await supabase
        .from("subjects")
        .select("id, name")
        .order("name", { ascending: true });

      const subjectOptions = (data ?? []).map((item) => ({
        id: item.id,
        name: item.name,
      }));

      if (subjectOptions.length > 0) {
        setSubjects(subjectOptions);
        return;
      }

      const { data: attendanceSubjectRows } = await supabase
        .from("attendance")
        .select("subject_id, subjects(name)")
        .eq("faculty_id", user?.id ?? "");

      const fallbackSubjectMap = new Map<string, SubjectOption>();
      (attendanceSubjectRows ?? []).forEach((row) => {
        const subject = Array.isArray(row.subjects) ? row.subjects[0] : row.subjects;
        if (!row.subject_id || !subject?.name) {
          return;
        }
        fallbackSubjectMap.set(row.subject_id, { id: row.subject_id, name: subject.name });
      });

      const fallbackSubjects = Array.from(fallbackSubjectMap.values());
      if (fallbackSubjects.length > 0) {
        setSubjects(fallbackSubjects);
        return;
      }

      if (subjectsError?.code === "42501") {
        setFormMessage("You don't have permission to read subjects. Please update subjects RLS policy.");
        return;
      }

      setFormMessage("No subjects found. Add subjects in database first.");

      setSubjects([]);
    };

    if (user?.role === "faculty") {
      setFormMessage(null);
      void loadSubjects();
    }
  }, [user?.id, user?.role]);

  useEffect(() => {
    const initializeAttendance = async () => {
      if (!user) return;

      const loadFallbackStudents = async () => {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("id, full_name")
          .eq("role", "student")
          .order("full_name", { ascending: true });

        const profileStudents: StudentWithStatus[] = (profileData ?? []).map((student) => ({
          student_id: student.id,
          full_name: student.full_name ?? "Unknown Student",
          status: null,
        }));

        if (profileStudents.length > 0) {
          setFallbackStudents(profileStudents);
          return;
        }

        const { data: classStudentData } = await supabase
          .from("class_students")
          .select("student_id, profiles(full_name)");

        const classStudents: StudentWithStatus[] = (classStudentData ?? []).map((row) => {
          const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
          return {
            student_id: row.student_id,
            full_name: profile?.full_name ?? "Unknown Student",
            status: null,
          };
        });

        if (classStudents.length > 0) {
          setFallbackStudents(classStudents);
          return;
        }

        const { data: attendanceStudents } = await supabase
          .from("attendance")
          .select("student_id, profiles!attendance_student_id_fkey(full_name)")
          .eq("faculty_id", user.id)
          .order("date", { ascending: false });

        const dedupedFromAttendance = Array.from(
          new Map(
            (attendanceStudents ?? []).map((row) => {
              const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
              const fullName = profile?.full_name ?? "Unknown Student";
              return [
                row.student_id,
                {
                  student_id: row.student_id,
                  full_name: fullName,
                  status: null,
                } as StudentWithStatus,
              ];
            }),
          ).values(),
        );

        setFallbackStudents(dedupedFromAttendance);
      };

      if (user.role === "student") {
        await Promise.all([loadStudentSummary(user.id), loadStudentHistory(user.id)]);
        return;
      }

      const { data, error: classError } = await supabase
        .from("attendance")
        .select("class_id")
        .eq("faculty_id", user.id)
        .limit(1)
        .maybeSingle<{ class_id: string }>();

      if (classError || !data?.class_id) {
        await loadFallbackStudents();
        return;
      }

      setSelectedClassId(data.class_id);
      await loadStudents(data.class_id);
      await loadFallbackStudents();
    };

    void initializeAttendance();
  }, [user]);

  useEffect(() => {
    if (user?.role === "faculty" && selectedStudentId) {
      void Promise.all([
        loadStudentSummary(selectedStudentId),
        loadStudentHistory(selectedStudentId),
      ]);
    }
  }, [selectedStudentId, user?.role, loadStudentSummary, loadStudentHistory]);

  useEffect(() => {
    const resolveClassForSelectedStudent = async () => {
      if (user?.role !== "faculty" || !selectedStudentId) {
        return;
      }

      const { data } = await supabase
        .from("class_students")
        .select("class_id")
        .eq("student_id", selectedStudentId)
        .limit(1)
        .maybeSingle<{ class_id: string }>();

      if (data?.class_id) {
        setSelectedClassId(data.class_id);
      }
    };

    void resolveClassForSelectedStudent();
  }, [selectedStudentId, user?.role]);

  useEffect(() => {
    if (user?.role === "faculty" && displayedStudents.length > 0 && !selectedStudentId) {
      setSelectedStudentId(displayedStudents[0].student_id);
    }
  }, [displayedStudents, selectedStudentId, user?.role]);

  useEffect(() => {
    const loadStudentClassMappings = async () => {
      if (user?.role !== "faculty" || displayedStudents.length === 0) {
        return;
      }

      const studentIds = displayedStudents.map((student) => student.student_id);
      const { data } = await supabase
        .from("class_students")
        .select("student_id, class_id")
        .in("student_id", studentIds);

      const nextMap = (data ?? []).reduce<Record<string, string>>((acc, row) => {
        if (!acc[row.student_id]) {
          acc[row.student_id] = row.class_id;
        }
        return acc;
      }, {});

      setStudentClassMap(nextMap);
    };

    void loadStudentClassMappings();
  }, [displayedStudents, user?.role]);

  useEffect(() => {
    const latest = attendanceHistory[0];
    const classId = resolvedClassIdForSelectedStudent;
    if (!latest || !classId) {
      return;
    }

    void loadExistingAttendance({
      class_id: classId,
      subject_id: latest.subject_id,
      date: latest.date,
    });
  }, [attendanceHistory, resolvedClassIdForSelectedStudent, loadExistingAttendance]);

  useEffect(() => {
    const classId = resolvedClassIdForSelectedStudent;
    if (!classId || !selectedSubjectId || !selectedDate) {
      return;
    }

    void loadExistingAttendance({
      class_id: classId,
      subject_id: selectedSubjectId,
      date: selectedDate,
    });
  }, [resolvedClassIdForSelectedStudent, selectedSubjectId, selectedDate, loadExistingAttendance]);

  useEffect(() => {
    const matchedRecord = existingAttendance.find((row) => row.student_id === selectedStudentId);
    if (matchedRecord) {
      setSelectedStatus(matchedRecord.status);
    }
  }, [existingAttendance, selectedStudentId]);

  useEffect(() => {
    const lastAttendedBySubject = attendanceHistory.reduce<Record<string, string>>((acc, item) => {
      if (!acc[item.subject_id]) {
        acc[item.subject_id] = item.date;
      }
      return acc;
    }, {});

    const mappedData: AttendanceSummary[] = attendanceSummary.map((item) => ({
      id: item.subject_id,
      subject: item.subject_name,
      teacher: "N/A",
      totalClasses: item.total_classes,
      attended: item.present_count,
      percentage: item.percentage,
      lastAttended: lastAttendedBySubject[item.subject_id] ?? new Date().toISOString(),
    }));

    setCurrentAttendanceData(mappedData);
  }, [attendanceSummary, attendanceHistory]);

  const loading = loadingStudents || loadingSummary || loadingHistory;

  const handleMarkAttendance = async () => {
    setFormMessage(null);

    if (!user || user.role !== "faculty") {
      setFormMessage("Only faculty can mark attendance.");
      return;
    }

    const classId = resolvedClassIdForSelectedStudent;

    if (!selectedStudentId || !selectedSubjectId || !selectedDate) {
      setFormMessage("Select student, subject and date before saving attendance.");
      return;
    }

    if (!classId) {
      setFormMessage("Selected student is not mapped to any class.");
      return;
    }

    await markAttendance([
      {
        student_id: selectedStudentId,
        faculty_id: user.id,
        class_id: classId,
        subject_id: selectedSubjectId,
        date: selectedDate,
        status: selectedStatus,
      },
    ]);

    await loadExistingAttendance({
      class_id: classId,
      subject_id: selectedSubjectId,
      date: selectedDate,
    });

    await Promise.all([
      loadStudentSummary(selectedStudentId),
      loadStudentHistory(selectedStudentId),
    ]);
  };

  const selectedStudent = useMemo(
    () => displayedStudents.find((student) => student.student_id === selectedStudentId) || null,
    [displayedStudents, selectedStudentId]
  );

  const getAttendanceBadge = (percentage: number) => {
    if (percentage >= 90) return "default";
    if (percentage >= 80) return "secondary";
    return "destructive";
  };

  const getAttendanceStatus = (percentage: number) => {
    if (percentage >= 90) return "Excellent";
    if (percentage >= 80) return "Good";
    if (percentage >= 75) return "Warning";
    return "Critical";
  };

  const overallAttendance = useMemo(() => {
    if (currentAttendanceData.length === 0) return 0;
    return Math.round(
      currentAttendanceData.reduce((sum, subject) => sum + subject.percentage, 0) / currentAttendanceData.length
    );
  }, [currentAttendanceData]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Attendance</h1>
        <p className="text-muted-foreground">
          {user?.role === 'faculty' ? 'View student attendance records' : 'Track your class attendance records'}
        </p>
      </div>

      {/* Faculty Student Selection */}
      {user?.role === 'faculty' && (
        <Card>
          <CardHeader>
            <CardTitle>Select Student</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Select value={selectedStudentId} onValueChange={setSelectedStudentId}>
                <SelectTrigger className="w-full md:w-[300px]">
                  <SelectValue placeholder="Select a student" />
                </SelectTrigger>
                <SelectContent>
                  {displayedStudents.map((student) => (
                    <SelectItem key={student.student_id} value={student.student_id}>
                      {student.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <Select value={selectedSubjectId} onValueChange={setSelectedSubjectId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select subject" />
                  </SelectTrigger>
                  <SelectContent>
                    {subjects.map((subject) => (
                      <SelectItem key={subject.id} value={subject.id}>
                        {subject.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Input
                  type="date"
                  value={selectedDate}
                  onChange={(event) => setSelectedDate(event.target.value)}
                />

                <Select
                  value={selectedStatus}
                  onValueChange={(value) => setSelectedStatus(value as AttendanceStatus)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="present">Present</SelectItem>
                    <SelectItem value="absent">Absent</SelectItem>
                  </SelectContent>
                </Select>

                <Button onClick={() => void handleMarkAttendance()} disabled={loadingAttendance}>
                  {loadingAttendance ? "Saving..." : "Save Attendance"}
                </Button>
              </div>

              {(formMessage || success) && (
                <p className={`text-sm ${formMessage ? "text-destructive" : "text-emerald-600"}`}>
                  {formMessage ?? success}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {loading && (
        <Card>
          <CardContent className="py-8 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </CardContent>
        </Card>
      )}

      {error && (
        <Card>
          <CardContent className="py-6 text-center text-destructive">{error}</CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Overall Attendance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{overallAttendance}%</div>
            <Progress value={overallAttendance} className="mt-2" />
            <p className="text-xs text-muted-foreground mt-2">
              Status: <Badge variant={getAttendanceBadge(overallAttendance)}>
                {getAttendanceStatus(overallAttendance)}
              </Badge>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Classes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {currentAttendanceData.reduce((sum, subject) => sum + subject.totalClasses, 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Across all subjects
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Classes Attended</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {currentAttendanceData.reduce((sum, subject) => sum + subject.attended, 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Total attended classes
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {user?.role === 'faculty' ? `Attendance - ${selectedStudent?.full_name || 'Student'}` : 'Subject-wise Attendance'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Subject</TableHead>
                <TableHead>Teacher</TableHead>
                <TableHead>Attended/Total</TableHead>
                <TableHead>Percentage</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Attended</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {currentAttendanceData.length > 0 ? (
                currentAttendanceData.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell className="font-medium">{record.subject}</TableCell>
                    <TableCell>{record.teacher}</TableCell>
                    <TableCell>
                      {record.attended}/{record.totalClasses}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <span>{record.percentage}%</span>
                        <Progress value={record.percentage} className="w-16" />
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getAttendanceBadge(record.percentage)}>
                        {getAttendanceStatus(record.percentage)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(record.lastAttended).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    No attendance records found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
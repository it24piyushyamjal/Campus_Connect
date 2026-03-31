import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Calendar, Upload, Download, User, Clock, AlertCircle, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { assignmentsApi, type Assignment as APIAssignment, type Submission as APISubmission } from "@/services/assignments";

interface Assignment extends APIAssignment {
  submissions?: APISubmission[];
}

interface Submission extends APISubmission {
  studentName?: string;
}

export default function Assignments() {
  const { user } = useAuth();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNewAssignment, setShowNewAssignment] = useState(false);
  const [newAssignment, setNewAssignment] = useState({
    title: "",
    description: "",
    subject: "Mathematics",
    dueDate: "",
    maxMarks: 100,
  });
  const [submissions, setSubmissions] = useState<{ [key: string]: string }>({});
  const [creating, setCreating] = useState(false);

  const subjects = ["Mathematics", "Physics", "Chemistry", "Computer Science", "English", "Biology"];

  useEffect(() => {
    if (user) {
      fetchAssignments();
    }
  }, [user]);

  const fetchAssignments = async () => {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      const className = user.role === "student" ? user.className : null;
      if (user.role === "student" && !className) {
        setAssignments([]);
        setLoading(false);
        return;
      }

      const { data, error } = await assignmentsApi.getAssignments(className || "IT-A");
      if (error) {
        setError(error.message);
      } else {
        if (user.role === "faculty" && data) {
          const assignmentsWithSubmissions = await Promise.all(
            data.map(async (assignment) => {
              const { data: subs } = await assignmentsApi.getSubmissions(assignment.id);
              return {
                ...assignment,
                submissions: subs || [],
              };
            })
          );
          setAssignments(assignmentsWithSubmissions);
        } else {
          setAssignments(data || []);
        }
      }
    } catch (err) {
      setError("Failed to fetch assignments");
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (assignment: Assignment) => {
    const now = new Date();
    const dueDate = new Date(assignment.due_date || assignment.dueDate);
    const isOverdue = dueDate < now;

    if (user?.role === "student") {
      const hasSubmitted = assignment.submissions?.some((s) => s.student_id === user.id || s.studentId === user.id);
      if (hasSubmitted) return <Badge variant="default">Submitted</Badge>;
      if (isOverdue) return <Badge variant="destructive">Overdue</Badge>;
      return <Badge variant="secondary">Pending</Badge>;
    }

    return isOverdue ? <Badge variant="destructive">Overdue</Badge> : <Badge variant="default">Active</Badge>;
  };

  const getDaysRemaining = (dueDateString: string) => {
    const now = new Date();
    const due = new Date(dueDateString);
    const diff = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  };

  const handleCreateAssignment = async () => {
    if (!user) return;
    if (!newAssignment.title.trim() || !newAssignment.description.trim() || !newAssignment.dueDate) return;

    setCreating(true);
    try {
      const { data, error } = await assignmentsApi.createAssignment({
        title: newAssignment.title,
        description: newAssignment.description,
        subject: newAssignment.subject,
        due_date: newAssignment.dueDate,
        max_marks: newAssignment.maxMarks,
        assigned_by: user.id,
        class: user.className || "IT-A",
      });

      if (error) {
        setError(error.message);
      } else if (data) {
        setAssignments((prev) => [data, ...prev]);
        setShowNewAssignment(false);
        setNewAssignment({ title: "", description: "", subject: "Mathematics", dueDate: "", maxMarks: 100 });
      }
    } catch (err) {
      setError("Failed to create assignment");
    } finally {
      setCreating(false);
    }
  };

  const handleSubmitAssignment = async (assignmentId: string) => {
    if (!user) return;
    const content = submissions[assignmentId];
    if (!content?.trim()) return;

    try {
      const { error } = await assignmentsApi.submitAssignment({
        assignment_id: assignmentId,
        student_id: user.id,
        attachments: [],
      });
      if (error) {
        setError(error.message);
      } else {
        fetchAssignments();
        setSubmissions((prev) => ({ ...prev, [assignmentId]: "" }));
      }
    } catch {
      setError("Failed to submit assignment");
    }
  };

  const getSubmissionForUser = (assignment: Assignment) => {
    return assignment.submissions?.find((s) => s.student_id === user?.id || (s as any).studentId === user?.id);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Assignments</h1>
          <p className="text-muted-foreground">{user?.role === "faculty" ? "Manage and grade assignments" : "View and submit assignments"}</p>
        </div>
        {user?.role === "faculty" && (
          <Button onClick={() => setShowNewAssignment(true)}>Create Assignment</Button>
        )}
      </div>

      {user?.role === "faculty" && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card><CardHeader className="pb-3"><CardTitle className="text-sm font-medium">Total Assignments</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-foreground">{assignments.length}</div></CardContent></Card>
          <Card><CardHeader className="pb-3"><CardTitle className="text-sm font-medium">Total Submissions</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-foreground">{assignments.reduce((s, a) => s + (a.submissions?.length || 0), 0)}</div></CardContent></Card>
          <Card><CardHeader className="pb-3"><CardTitle className="text-sm font-medium">Pending Review</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-yellow-600">{assignments.reduce((s, a) => s + (a.submissions?.filter((x) => x.marks === undefined).length || 0), 0)}</div></CardContent></Card>
          <Card><CardHeader className="pb-3"><CardTitle className="text-sm font-medium">Graded</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-green-600">{assignments.reduce((s, a) => s + (a.submissions?.filter((x) => x.marks !== undefined).length || 0), 0)}</div></CardContent></Card>
        </div>
      )}

      {showNewAssignment && user?.role === "faculty" && (
        <Card>
          <CardHeader><CardTitle>Create New Assignment</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><label className="text-sm font-medium">Title</label><Input value={newAssignment.title} onChange={(e) => setNewAssignment((prev) => ({ ...prev, title: e.target.value }))} /></div>
              <div><label className="text-sm font-medium">Subject</label><select value={newAssignment.subject} onChange={(e) => setNewAssignment((prev) => ({ ...prev, subject: e.target.value }))} className="w-full px-3 py-2 border border-input bg-background rounded-md">{subjects.map((subject) => <option key={subject} value={subject}>{subject}</option>)}</select></div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><label className="text-sm font-medium">Due Date</label><Input type="date" value={newAssignment.dueDate} onChange={(e) => setNewAssignment((prev) => ({ ...prev, dueDate: e.target.value }))} /></div>
              <div><label className="text-sm font-medium">Max Marks</label><Input type="number" value={newAssignment.maxMarks} onChange={(e) => setNewAssignment((prev) => ({ ...prev, maxMarks: Number(e.target.value) }))} /></div>
            </div>
            <div><label className="text-sm font-medium">Description</label><Textarea value={newAssignment.description} onChange={(e) => setNewAssignment((prev) => ({ ...prev, description: e.target.value }))} rows={4} /></div>
            <div className="flex gap-2">
              <Button onClick={handleCreateAssignment} disabled={creating}>{creating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}Create Assignment</Button>
              <Button variant="outline" onClick={() => setShowNewAssignment(false)} disabled={creating}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
      ) : error ? (
        <Card><CardContent className="text-center py-8"><p className="text-red-600">{error}</p><Button onClick={fetchAssignments} className="mt-4">Retry</Button></CardContent></Card>
      ) : (
        <div className="space-y-4">
          {assignments.map((assignment) => {
            const userSubmission = getSubmissionForUser(assignment);
            const daysRemaining = getDaysRemaining(assignment.due_date || assignment.dueDate);
            return (
              <Card key={assignment.id}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="outline">{assignment.subject}</Badge>
                        {getStatusBadge(assignment)}
                        {daysRemaining <= 3 && daysRemaining >= 0 && (
                          <Badge variant="destructive" className="flex items-center gap-1"><AlertCircle className="h-3 w-3" />Due Soon</Badge>
                        )}
                      </div>
                      <h3 className="text-lg font-semibold">{assignment.title}</h3>
                      <p className="text-muted-foreground mt-2">{assignment.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1"><User className="h-4 w-4" />{assignment.assigned_by || "Unknown"}</div>
                    <div className="flex items-center gap-1"><Calendar className="h-4 w-4" />Due: {new Date(assignment.due_date || assignment.dueDate).toLocaleDateString()}</div>
                    <div className="flex items-center gap-1"><Clock className="h-4 w-4" />{daysRemaining >= 0 ? `${daysRemaining} days remaining` : `${Math.abs(daysRemaining)} days overdue`}</div>
                    <div>Max Marks: {assignment.max_marks || assignment.maxMarks || 0}</div>
                  </div>
                </CardHeader>
                <CardContent>
                  {user?.role === "student" && (
                    <div className="border-t pt-4">
                      {userSubmission ? (
                        <div className="space-y-2">
                          <h4 className="font-medium text-green-600">Your Submission</h4>
                          <p className="text-sm text-muted-foreground">Submitted on: {new Date((userSubmission as any).submission_date || (userSubmission as any).submissionDate).toLocaleDateString()}</p>
                          {userSubmission.marks !== undefined && <div className="flex items-center gap-2"><Badge variant="default">Graded: {userSubmission.marks}/{assignment.max_marks || assignment.maxMarks}</Badge></div>}
                          {userSubmission.feedback && <div className="bg-muted p-3 rounded-lg"><p className="text-sm font-medium">Feedback:</p><p className="text-sm">{userSubmission.feedback}</p></div>}
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <h4 className="font-medium">Submit Assignment</h4>
                          <Textarea placeholder="Enter your submission details..." value={submissions[assignment.id]} onChange={(e) => setSubmissions((prev) => ({ ...prev, [assignment.id]: e.target.value }))} rows={3} />
                          <div className="flex gap-2">
                            <Button size="sm" onClick={() => handleSubmitAssignment(assignment.id)} disabled={daysRemaining < 0}> <Upload className="h-3 w-3 mr-1" /> Submit </Button>
                            <Button size="sm" variant="outline"><Upload className="h-3 w-3 mr-1" /> Upload File </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {user?.role === "faculty" && assignment.submissions && assignment.submissions.length > 0 && (
                    <div className="border-t pt-4">
                      <h4 className="font-medium mb-3">Submissions ({assignment.submissions.length})</h4>
                      <div className="space-y-3">
                        {assignment.submissions.map((submission) => (
                          <div key={submission.id} className="border rounded-lg p-3">
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="font-medium">{(submission as any).profiles?.full_name || "Student"}</p>
                                <p className="text-sm text-muted-foreground">Submitted: {new Date((submission as any).submission_date || (submission as any).submissionDate).toLocaleDateString()}</p>
                              </div>
                              <div className="flex items-center gap-2">
                                {submission.marks !== undefined ? <Badge variant="default">{submission.marks}/{assignment.max_marks || assignment.maxMarks}</Badge> : <Badge variant="secondary">Pending Review</Badge>}
                                <Button size="sm" variant="outline">Grade</Button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {assignments.length === 0 && !loading && (
        <Card>
          <CardContent className="text-center py-8">
            <p className="text-muted-foreground">{user?.role === "faculty" ? "No assignments created yet." : "No assignments available."}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

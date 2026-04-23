import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import jsPDF from "jspdf";
import * as XLSX from "xlsx";
import { useTimetable } from '@/hooks/useTimetable';
import { FIXED_TIME_SLOTS, normalizeTimeSlot } from '@/services/timetableService';
import { Loader2, AlertTriangle } from 'lucide-react';

// ─── Constants ──────────────────────────────────────────────────────────────

const weekDays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

// ─── Component ──────────────────────────────────────────────────────────────

export default function Timetable() {
  const { user, availableClasses } = useAuth();
  const { toast } = useToast();

  const {
    timetableData,
    facultyList,
    subjectList,
    isLoading,
    loadClassTimetable,
    loadTeacherTimetable,
    validateAndSaveSlot,
    loadDropdownData,
  } = useTimetable();

  // ── View state ────────────────────────────────────────────────────────────
  const [selectedClass, setSelectedClass] = useState<string>(
    user?.role === 'student' ? user.className || '' : availableClasses[0],
  );
  const [viewType, setViewType] = useState<'class' | 'personal'>(
    user?.role === 'faculty' ? 'personal' : 'class',
  );

  useEffect(() => {
    if (viewType === 'class' && selectedClass) {
      loadClassTimetable(selectedClass);
    } else if (viewType === 'personal' && user?.name) {
      loadTeacherTimetable(user.name);
    }
  }, [viewType, selectedClass, user?.name, loadClassTimetable, loadTeacherTimetable]);

  useEffect(() => {
    if (user?.role === 'faculty') loadDropdownData();
  }, [user?.role, loadDropdownData]);

  // ── Edit modal state ──────────────────────────────────────────────────────
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  /** Original time_slot string of the row being edited — used for self-exclusion in clash check */
  const [originalTimeSlot, setOriginalTimeSlot] = useState<string>('');

  const [editingSlot, setEditingSlot] = useState<{ day: string } | null>(null);
  const [editedSubject, setEditedSubject] = useState('');
  const [editedTeacher, setEditedTeacher] = useState('');
  const [editedRoom, setEditedRoom] = useState('');
  const [editedTimeSlot, setEditedTimeSlot] = useState<string>(FIXED_TIME_SLOTS[0]);

  const [validationError, setValidationError] = useState<string | null>(null);
  const [clashErrors, setClashErrors] = useState<string[]>([]);

  // ── Derived timetable map ─────────────────────────────────────────────────
  /**
   * Build a lookup: day → time_slot → slot data.
   * Time slots are normalized to canonical "HH:MM - HH:MM".
   */
  const currentTimetable = useMemo(() => {
    const map: Record<string, Record<string, { class: string; subject: string; teacher: string; room: string; time_slot: string }>> = {};
    weekDays.forEach((d) => { map[d] = {}; });
    timetableData.forEach((slot) => {
      const normalizedTimeSlot = normalizeTimeSlot(slot.time_slot);
      if (!normalizedTimeSlot) return;
      if (!map[slot.day]) map[slot.day] = {};
      map[slot.day][normalizedTimeSlot] = {
        class: slot.class,
        subject: slot.subject,
        teacher: slot.teacher,
        room: slot.room,
        time_slot: normalizedTimeSlot,
      };
    });
    return map;
  }, [timetableData]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const closeDialog = () => {
    if (isSaving) return;
    setIsEditDialogOpen(false);
    setValidationError(null);
    setClashErrors([]);
  };

  const handleEditClick = (day: string, timeSlot: string) => {
    const data = currentTimetable[day]?.[timeSlot];
    setEditingSlot({ day });
    setOriginalTimeSlot(timeSlot);

    setEditedSubject(data?.subject || '');
    setEditedTeacher(data?.teacher || '');
    setEditedRoom(data?.room || '');
    setEditedTimeSlot(timeSlot);

    setValidationError(null);
    setClashErrors([]);
    setIsEditDialogOpen(true);
  };

  const handleSubjectChange = (val: string) => {
    setValidationError(null);
    setClashErrors([]);
    if (val === '__clear__') {
      setEditedSubject('');
      setEditedTeacher('');
      setEditedRoom('');
    } else {
      setEditedSubject(val);
    }
  };

  const handleTeacherChange = (val: string) => {
    setValidationError(null);
    setClashErrors([]);
    setEditedTeacher(val === '__none__' ? '' : val);
  };

  const handleSaveChanges = async () => {
    if (!editingSlot) return;
    const { day } = editingSlot;

    // ── Clear slot path ───────────────────────────────────────────────────
    if (!editedSubject) {
      setIsSaving(true);
      try {
        await validateAndSaveSlot(
          { class: selectedClass, day, time_slot: originalTimeSlot, subject: '', teacher: '', room: '' },
          originalTimeSlot,
        );
        closeDialog();
        toast({ title: 'Slot Cleared', description: 'Timetable entry removed.' });
      } catch {
        // hook shows toast
      } finally {
        setIsSaving(false);
      }
      return;
    }

    // ── Validation ────────────────────────────────────────────────────────
    if (!editedTeacher) {
      setValidationError('Please select a teacher before saving.');
      return;
    }
    if (!editedTimeSlot) {
      setValidationError('Please select a valid fixed time slot.');
      return;
    }

    // ── Clash check + save ────────────────────────────────────────────────
    setIsSaving(true);
    setClashErrors([]);
    try {
      const clashes = await validateAndSaveSlot(
        {
          class: selectedClass,
          day,
          time_slot: editedTimeSlot,
          subject: editedSubject,
          teacher: editedTeacher,
          room: editedRoom,
        },
        originalTimeSlot,
      );

      if (clashes.length > 0) {
        setClashErrors(clashes.map((c) => c.message));
        return;
      }

      closeDialog();
      toast({ title: 'Success!', description: 'Timetable updated successfully.' });
    } catch {
      // hook shows toast
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetTimetable = () => {
    if (viewType === 'class') loadClassTimetable(selectedClass);
    else if (user?.name) loadTeacherTimetable(user.name);
    toast({ title: 'Timetable Refreshed', description: 'Fetched latest timetable from database.' });
  };

  const handleDownload = (_format: 'pdf' | 'excel') => {
    // Download logic unchanged
  };

  // ── Badge helper ──────────────────────────────────────────────────────────
  const getSubjectBadgeVariant = (subject: string) => {
    if (subject === 'Break' || subject === 'Lunch') return 'secondary' as const;
    if (subject.toLowerCase().includes('lab') || subject.toLowerCase().includes('sports')) return 'destructive' as const;
    if (subject === 'Library' || subject === 'Project Work') return 'outline' as const;
    return 'default' as const;
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Timetable</h1>
          <p className="text-muted-foreground">
            {user?.role === 'faculty'
              ? 'Manage class schedules and view your timetable'
              : 'Your weekly class schedule'}
          </p>
        </div>
        <div className="flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button>Download</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => handleDownload('pdf')}>Download as PDF</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleDownload('excel')}>Download as Excel</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {user?.role === 'faculty' && (
            <Button variant="destructive" onClick={handleResetTimetable}>
              Refresh Timetable
            </Button>
          )}
        </div>
      </div>

      {/* ── Faculty view switcher ── */}
      {user?.role === 'faculty' && (
        <div className="flex flex-wrap gap-4">
          <div className="flex gap-2">
            <button
              onClick={() => setViewType('personal')}
              className={`px-4 py-2 rounded-lg transition-colors ${viewType === 'personal' ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'
                }`}
            >
              My Schedule
            </button>
            <button
              onClick={() => setViewType('class')}
              className={`px-4 py-2 rounded-lg transition-colors ${viewType === 'class' ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'
                }`}
            >
              Class Timetables
            </button>
          </div>

          {viewType === 'class' && (
            <Select value={selectedClass} onValueChange={setSelectedClass}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Select class" />
              </SelectTrigger>
              <SelectContent>
                {availableClasses.map((cls) => (
                  <SelectItem key={cls} value={cls}>{cls}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      )}

      {/* ── Grid ── */}
      <Card>
        <CardHeader>
          <CardTitle>
            {user?.role === 'faculty' && viewType === 'personal'
              ? `${user.name}'s Schedule`
              : `${selectedClass} - Weekly Schedule`}
          </CardTitle>
        </CardHeader>
        <CardContent className="relative">
          {isLoading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/50 backdrop-blur-sm rounded-lg">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          )}
          <div className="overflow-x-auto">
            <div className="grid grid-cols-[140px_repeat(5,1fr)] gap-2 min-w-[800px]">
              {/* Header row */}
              <div className="font-semibold text-center py-3 px-2 bg-muted rounded-lg">Time</div>
              {weekDays.map((day) => (
                <div key={day} className="font-semibold text-center py-3 px-2 bg-muted rounded-lg">
                  {day}
                </div>
              ))}

              {/* Data rows */}
              {FIXED_TIME_SLOTS.map((timeSlot) => (
                <>
                  <div key={timeSlot} className="font-medium text-center py-4 px-2 bg-muted/50 rounded-lg text-xs leading-snug">
                    {timeSlot.replace(' - ', '-')}
                  </div>
                  {weekDays.map((day) => {
                    const cellData = currentTimetable[day]?.[timeSlot];
                    return (
                      <div key={`${day}-${timeSlot}`} className="p-2">
                        <div className="border rounded-lg p-3 h-full bg-card hover:bg-accent transition-colors relative flex flex-col justify-center items-center min-h-[80px]">
                          {cellData && cellData.subject ? (
                            <div className="flex w-full flex-col items-center gap-1 text-center">
                              <Badge variant={getSubjectBadgeVariant(cellData.subject)} className="text-center">
                                {cellData.subject}
                              </Badge>

                              {user?.role === 'faculty' && cellData.class && (
                                <Badge variant="outline" className="text-[10px] px-2 py-0 h-5 tracking-wide">
                                  {cellData.class}
                                </Badge>
                              )}

                              {cellData.teacher && (
                                <p className="text-sm text-muted-foreground text-center">{cellData.teacher}</p>
                              )}

                              {cellData.room && (
                                <p className="text-xs text-muted-foreground text-center">Room: {cellData.room}</p>
                              )}

                              {user?.role === 'faculty' && (
                                <p className="mt-1 text-[11px] text-muted-foreground/80">
                                  {cellData.time_slot.replace(' - ', '–')}
                                </p>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">Free Slot</span>
                          )}
                          {user?.role === 'faculty' && viewType === 'class' && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="absolute top-2 right-2"
                              onClick={() => handleEditClick(day, timeSlot)}
                            >
                              Edit
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Edit Dialog ── */}
      <Dialog open={isEditDialogOpen} onOpenChange={(open) => { if (!open) closeDialog(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Timetable Slot</DialogTitle>
            {editingSlot && (
              <p className="text-sm text-muted-foreground">
                {editingSlot.day} · {selectedClass}
              </p>
            )}
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Subject */}
            <div className="grid grid-cols-4 items-center gap-4">
              <label htmlFor="subject" className="text-right text-sm font-medium">Subject</label>
              <Select value={editedSubject || '__clear__'} onValueChange={handleSubjectChange}>
                <SelectTrigger className="col-span-3" id="subject">
                  <SelectValue placeholder="Select subject" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__clear__" className="italic text-muted-foreground">— Clear Slot —</SelectItem>
                  {subjectList.map((s) => (
                    <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Teacher */}
            <div className="grid grid-cols-4 items-center gap-4">
              <label htmlFor="teacher" className="text-right text-sm font-medium">Teacher</label>
              <Select
                value={editedTeacher || '__none__'}
                onValueChange={handleTeacherChange}
                disabled={!editedSubject}
              >
                <SelectTrigger className="col-span-3" id="teacher">
                  <SelectValue placeholder={editedSubject ? 'Select teacher' : 'Select subject first'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__" className="italic text-muted-foreground">— None —</SelectItem>
                  {facultyList.map((f) => (
                    <SelectItem key={f.id} value={f.full_name}>{f.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Room */}
            <div className="grid grid-cols-4 items-center gap-4">
              <label htmlFor="room" className="text-right text-sm font-medium">Room</label>
              <Input
                id="room"
                value={editedRoom}
                onChange={(e) => { setEditedRoom(e.target.value); setClashErrors([]); }}
                className="col-span-3"
                placeholder="e.g. IT-101"
                disabled={!editedSubject}
              />
            </div>

            {/* Fixed Time Slot */}
            <div className="grid grid-cols-4 items-center gap-4">
              <label htmlFor="time-slot" className="text-right text-sm font-medium">Time Slot</label>
              <Select value={editedTimeSlot} onValueChange={(val) => { setEditedTimeSlot(val); setValidationError(null); setClashErrors([]); }}>
                <SelectTrigger className="col-span-3" id="time-slot">
                  <SelectValue placeholder="Select fixed slot" />
                </SelectTrigger>
                <SelectContent>
                  {FIXED_TIME_SLOTS.map((slot) => (
                    <SelectItem key={slot} value={slot}>{slot.replace(' - ', '-')}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Validation / Clash errors */}
          {validationError && (
            <p className="text-sm text-destructive px-1 -mt-2">{validationError}</p>
          )}
          {clashErrors.length > 0 && (
            <div className="rounded-md border border-destructive bg-destructive/10 p-3 space-y-1 -mt-2">
              <div className="flex items-center gap-2 text-destructive font-medium text-sm">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                Scheduling Conflict Detected
              </div>
              {clashErrors.map((msg, i) => (
                <p key={i} className="text-sm text-destructive pl-6">{msg}</p>
              ))}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} disabled={isSaving}>Cancel</Button>
            <Button onClick={handleSaveChanges} disabled={isSaving}>
              {isSaving
                ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</>
                : editedSubject ? 'Save Changes' : 'Clear Slot'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

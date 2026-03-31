import { useState, useEffect } from 'react';
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import jsPDF from "jspdf";
import * as XLSX from "xlsx";

const timeSlots = [
  "9:00 AM", "10:00 AM", "11:00 AM", "12:00 PM", 
  "1:00 PM", "2:00 PM", "3:00 PM", "4:00 PM"
];

const weekDays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

// Class-specific timetable data
const initialTimetableData = {
  "IT-A": {
    "Monday": {
      "9:00 AM": { subject: "Programming", teacher: "Dr. Prakash Raj", room: "IT-101" },
      "10:00 AM": { subject: "Web Development", teacher: "Prof. Arjun Menon", room: "IT-201" },
      "11:00 AM": { subject: "Break", teacher: "", room: "" },
      "12:00 PM": { subject: "Database Management", teacher: "Dr. Umair Khan", room: "IT-301" },
      "1:00 PM": { subject: "Lunch", teacher: "", room: "" },
      "2:00 PM": { subject: "Software Engineering", teacher: "Ms. Anjali Rao", room: "IT-102" },
      "3:00 PM": { subject: "System Analysis", teacher: "Mr. Rohan Joshi", room: "IT-401" },
      "4:00 PM": { subject: "Programming Lab", teacher: "Mr. Rohan Joshi", room: "Lab-A" },
    },
    "Tuesday": {
      "9:00 AM": { subject: "Web Development", teacher: "Prof. Arjun Menon", room: "IT-201" },
      "10:00 AM": { subject: "Programming", teacher: "Dr. Prakash Raj", room: "IT-101" },
      "11:00 AM": { subject: "Break", teacher: "", room: "" },
      "12:00 PM": { subject: "Software Engineering", teacher: "Ms. Anjali Rao", room: "IT-102" },
      "1:00 PM": { subject: "Lunch", teacher: "", room: "" },
      "2:00 PM": { subject: "Database Management", teacher: "Dr. Umair Khan", room: "IT-301" },
      "3:00 PM": { subject: "Network Security", teacher: "Dr. Ayush Kalse", room: "IT-302" },
      "4:00 PM": { subject: "Sports", teacher: "Coach Lee", room: "Ground" },
    },
  },
  "IT-B": {
    "Monday": {
        "9:00 AM": { subject: "Data Structures", teacher: "Dr. Smith", room: "CS-103" },
        "10:00 AM": { subject: "Computer Networks", teacher: "Prof. Johnson", room: "CS-207" },
    }
  }
};

export default function Timetable() {
  const { user, availableClasses } = useAuth();
  const { toast } = useToast();
  
  const [timetableData, setTimetableData] = useState(() => {
    try {
      const savedTimetable = localStorage.getItem('timetableData');
      return savedTimetable ? JSON.parse(savedTimetable) : initialTimetableData;
    } catch (error) {
      console.error("Error parsing timetable from localStorage", error);
      return initialTimetableData;
    }
  });

  useEffect(() => {
    localStorage.setItem('timetableData', JSON.stringify(timetableData));
  }, [timetableData]);

  const [selectedClass, setSelectedClass] = useState<string>(
    user?.role === 'student' ? user.className || '' : availableClasses[0]
  );
  const [viewType, setViewType] = useState<'class' | 'personal'>(
    user?.role === 'faculty' ? 'personal' : 'class'
  );
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingSlot, setEditingSlot] = useState<{ day: string; time: string; } | null>(null);
  const [editedSubject, setEditedSubject] = useState("");
  const [editedTeacher, setEditedTeacher] = useState("");
  const [editedRoom, setEditedRoom] = useState("");

  const handleEditClick = (day: string, time: string) => {
    const classData = currentTimetable[day]?.[time] || {};
    setEditingSlot({ day, time });
    setEditedSubject(classData.subject || "");
    setEditedTeacher(classData.teacher || "");
    setEditedRoom(classData.room || "");
    setIsEditDialogOpen(true);
  };

  const handleSaveChanges = () => {
    if (editingSlot) {
      const { day, time } = editingSlot;
      const updatedTimetable = JSON.parse(JSON.stringify(timetableData));

      if (!updatedTimetable[selectedClass as keyof typeof initialTimetableData]) {
          updatedTimetable[selectedClass as keyof typeof initialTimetableData] = {};
      }
      if (!updatedTimetable[selectedClass as keyof typeof initialTimetableData][day]) {
          updatedTimetable[selectedClass as keyof typeof initialTimetableData][day] = {};
      }

      updatedTimetable[selectedClass as keyof typeof initialTimetableData][day][time] = {
        subject: editedSubject,
        teacher: editedTeacher,
        room: editedRoom,
      };
      setTimetableData(updatedTimetable);
      setIsEditDialogOpen(false);
      setEditingSlot(null);
      toast({
        title: "Success!",
        description: "Timetable updated successfully.",
      });
    }
  };

  const handleResetTimetable = () => {
    localStorage.removeItem('timetableData');
    setTimetableData(initialTimetableData);
    toast({
      title: "Timetable Reset",
      description: "The timetable has been reset to its original state.",
    });
  };

  const getSubjectBadgeVariant = (subject: string) => {
    if (subject === "Break" || subject === "Lunch") return "secondary";
    if (subject.toLowerCase().includes("lab") || subject.toLowerCase().includes("sports")) return "destructive";
    if (subject === "Library" || subject === "Project Work") return "outline";
    return "default";
  };

  const getCurrentTimetable = () => {
    if (user?.role === 'faculty' && viewType === 'personal') {
      // This is a placeholder for the faculty's personal view
      return {}; 
    }
    return timetableData[selectedClass as keyof typeof initialTimetableData] || {};
  };

  const currentTimetable = getCurrentTimetable();

  const handleDownload = (format: "pdf" | "excel") => {
    // ... (handleDownload function remains the same)
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Timetable</h1>
          <p className="text-muted-foreground">
            {user?.role === 'faculty' ? 'Manage class schedules and view your timetable' : 'Your weekly class schedule'}
          </p>
        </div>
        <div className="flex gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button>Download</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => handleDownload("pdf")}>
                  Download as PDF
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleDownload("excel")}>
                  Download as Excel
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            {user?.role === 'faculty' && (
              <Button variant="destructive" onClick={handleResetTimetable}>Reset Timetable</Button>
            )}
        </div>
      </div>

      {user?.role === 'faculty' && (
        <div className="flex flex-wrap gap-4">
          <div className="flex gap-2">
            <button
              onClick={() => setViewType('personal')}
              className={`px-4 py-2 rounded-lg transition-colors ${
                viewType === 'personal'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted hover:bg-muted/80'
              }`}
            >
              My Schedule
            </button>
            <button
              onClick={() => setViewType('class')}
              className={`px-4 py-2 rounded-lg transition-colors ${
                viewType === 'class'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted hover:bg-muted/80'
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
                {availableClasses.map((className) => (
                  <SelectItem key={className} value={className}>
                    {className}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>
            {user?.role === 'faculty' && viewType === 'personal'
              ? `${user.name}'s Schedule`
              : `${selectedClass} - Weekly Schedule`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <div className="grid grid-cols-[100px_repeat(5,1fr)] gap-2 min-w-[800px]">
              {/* Header */}
              <div className="font-semibold text-center py-3 px-2 bg-muted rounded-lg">
                Time
              </div>
              {weekDays.map((day) => (
                <div key={day} className="font-semibold text-center py-3 px-2 bg-muted rounded-lg">
                  {day}
                </div>
              ))}

              {/* Time slots */}
              {timeSlots.map((time) => (
                <>
                  <div key={time} className="font-medium text-center py-4 px-2 bg-muted/50 rounded-lg">
                    {time}
                  </div>
                  {weekDays.map((day) => {
                    const classData = currentTimetable[day]?.[time];
                    return (
                      <div key={`${day}-${time}`} className="p-2">
                        <div className="border rounded-lg p-3 h-full bg-card hover:bg-accent transition-colors relative flex flex-col justify-center items-center">
                          {classData && classData.subject ? (
                            <>
                              <Badge 
                                variant={getSubjectBadgeVariant(classData.subject)}
                                className="mb-2"
                              >
                                {classData.subject}
                              </Badge>
                              {classData.teacher && (
                                <p className="text-sm text-muted-foreground mb-1">
                                  {classData.teacher}
                                </p>
                              )}
                              {classData.room && (
                                <p className="text-xs text-muted-foreground">
                                  Room: {classData.room}
                                </p>
                              )}
                            </>
                          ) : (
                            <span className="text-xs text-muted-foreground">Free Slot</span>
                          )}
                          {user?.role === 'faculty' && viewType === 'class' && (
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="absolute top-2 right-2"
                              onClick={() => handleEditClick(day, time)}
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

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Timetable Slot</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <label htmlFor="subject" className="text-right">Subject</label>
              <Input id="subject" value={editedSubject} onChange={(e) => setEditedSubject(e.target.value)} className="col-span-3" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <label htmlFor="teacher" className="text-right">Teacher</label>
              <Input id="teacher" value={editedTeacher} onChange={(e) => setEditedTeacher(e.target.value)} className="col-span-3" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <label htmlFor="room" className="text-right">Room</label>
              <Input id="room" value={editedRoom} onChange={(e) => setEditedRoom(e.target.value)} className="col-span-3" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveChanges}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

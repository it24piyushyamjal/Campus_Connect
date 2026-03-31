import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertCircle, CheckCircle, Clock, Wrench, Plus } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface MaintenanceRequest {
  id: number;
  title: string;
  description: string;
  category: string;
  location: string;
  priority: "Low" | "Medium" | "High" | "Critical";
  status: "Pending" | "In Progress" | "Resolved" | "Rejected";
  reportedBy: string;
  reportedDate: string;
  resolvedDate?: string;
  assignedTo?: string;
}

const initialRequests: MaintenanceRequest[] = [
  {
    id: 1,
    title: "AC not working in Room 101",
    description: "The air conditioning unit in classroom 101 is not cooling properly. Temperature is uncomfortable for students.",
    category: "HVAC",
    location: "Room 101, Building A",
    priority: "High",
    status: "In Progress",
    reportedBy: "Devang Keloth",
    reportedDate: "2024-01-10",
    assignedTo: "Maintenance Team A"
  },
  {
    id: 2,
    title: "Broken projector in Lecture Hall",
    description: "The projector screen is not displaying properly. There are dark spots and flickering.",
    category: "Electronics",
    location: "Lecture Hall 1",
    priority: "Medium",
    status: "Pending",
    reportedBy: "Dr. Prakash Raj",
    reportedDate: "2024-01-12"
  },
  {
    id: 3,
    title: "Water leak in restroom",
    description: "There's a water leak under the sink in the men's restroom on the second floor.",
    category: "Plumbing",
    location: "2nd Floor Restroom, Building B",
    priority: "High",
    status: "Resolved",
    reportedBy: "Sneha Gupta",
    reportedDate: "2024-01-08",
    resolvedDate: "2024-01-09",
    assignedTo: "Plumbing Team"
  },
  {
    id: 4,
    title: "Broken chair in Library",
    description: "One of the study chairs in the library has a broken leg and is unsafe to use.",
    category: "Furniture",
    location: "Library, Section C",
    priority: "Low",
    status: "Resolved",
    reportedBy: "Kavya Nair",
    reportedDate: "2024-01-05",
    resolvedDate: "2024-01-07",
    assignedTo: "Maintenance Team B"
  }
];

export default function Maintenance() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<MaintenanceRequest[]>(initialRequests);
  const [showNewRequest, setShowNewRequest] = useState(false);
  const [newRequest, setNewRequest] = useState({
    title: "",
    description: "",
    category: "General",
    location: "",
    priority: "Medium" as const
  });

  const categories = ["General", "HVAC", "Electronics", "Plumbing", "Furniture", "Safety", "Cleaning"];
  const priorities = ["Low", "Medium", "High", "Critical"];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Resolved":
        return <Badge variant="default" className="flex items-center gap-1">
          <CheckCircle className="h-3 w-3" />
          Resolved
        </Badge>;
      case "In Progress":
        return <Badge variant="secondary" className="flex items-center gap-1">
          <Wrench className="h-3 w-3" />
          In Progress
        </Badge>;
      case "Pending":
        return <Badge variant="destructive" className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          Pending
        </Badge>;
      case "Rejected":
        return <Badge variant="outline" className="flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          Rejected
        </Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "Critical":
        return <Badge variant="destructive">{priority}</Badge>;
      case "High":
        return <Badge variant="destructive">{priority}</Badge>;
      case "Medium":
        return <Badge variant="secondary">{priority}</Badge>;
      case "Low":
        return <Badge variant="outline">{priority}</Badge>;
      default:
        return <Badge variant="outline">{priority}</Badge>;
    }
  };

  const handleSubmitRequest = () => {
    if (!newRequest.title.trim() || !newRequest.description.trim() || !newRequest.location.trim()) {
      return;
    }

    const request: MaintenanceRequest = {
      id: Date.now(),
      title: newRequest.title,
      description: newRequest.description,
      category: newRequest.category,
      location: newRequest.location,
      priority: newRequest.priority,
      status: "Pending",
      reportedBy: user?.name || "Anonymous",
      reportedDate: new Date().toISOString().split('T')[0]
    };

    setRequests([request, ...requests]);
    setNewRequest({
      title: "",
      description: "",
      category: "General",
      location: "",
      priority: "Medium"
    });
    setShowNewRequest(false);
  };

  const pendingCount = requests.filter(r => r.status === "Pending").length;
  const inProgressCount = requests.filter(r => r.status === "In Progress").length;
  const resolvedCount = requests.filter(r => r.status === "Resolved").length;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Maintenance Requests</h1>
          <p className="text-muted-foreground">Report and track facility maintenance issues</p>
        </div>
        <Button onClick={() => setShowNewRequest(true)} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          New Request
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Requests</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{requests.length}</div>
            <p className="text-xs text-muted-foreground mt-1">All time</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{pendingCount}</div>
            <p className="text-xs text-muted-foreground mt-1">Awaiting action</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">In Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{inProgressCount}</div>
            <p className="text-xs text-muted-foreground mt-1">Being worked on</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Resolved</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{resolvedCount}</div>
            <p className="text-xs text-muted-foreground mt-1">Completed</p>
          </CardContent>
        </Card>
      </div>

      {/* New Request Form */}
      {showNewRequest && (
        <Card>
          <CardHeader>
            <CardTitle>Submit New Maintenance Request</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Title</label>
                <Input
                  placeholder="Brief description of the issue"
                  value={newRequest.title}
                  onChange={(e) => setNewRequest({ ...newRequest, title: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Location</label>
                <Input
                  placeholder="Room number, building, etc."
                  value={newRequest.location}
                  onChange={(e) => setNewRequest({ ...newRequest, location: e.target.value })}
                />
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Category</label>
                <select
                  value={newRequest.category}
                  onChange={(e) => setNewRequest({ ...newRequest, category: e.target.value })}
                  className="w-full px-3 py-2 border border-input bg-background rounded-md"
                >
                  {categories.map(category => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">Priority</label>
                <select
                  value={newRequest.priority}
                  onChange={(e) => setNewRequest({ ...newRequest, priority: e.target.value as any })}
                  className="w-full px-3 py-2 border border-input bg-background rounded-md"
                >
                  {priorities.map(priority => (
                    <option key={priority} value={priority}>{priority}</option>
                  ))}
                </select>
              </div>
            </div>
            
            <div>
              <label className="text-sm font-medium">Description</label>
              <Textarea
                placeholder="Detailed description of the issue"
                value={newRequest.description}
                onChange={(e) => setNewRequest({ ...newRequest, description: e.target.value })}
                rows={4}
              />
            </div>
            
            <div className="flex gap-2">
              <Button onClick={handleSubmitRequest}>Submit Request</Button>
              <Button variant="outline" onClick={() => setShowNewRequest(false)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Requests Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Maintenance Requests</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Reported By</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.map((request) => (
                <TableRow key={request.id}>
                  <TableCell className="font-medium">
                    <div>
                      <div className="font-medium">{request.title}</div>
                      <div className="text-sm text-muted-foreground line-clamp-2">
                        {request.description}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{request.category}</Badge>
                  </TableCell>
                  <TableCell className="text-sm">{request.location}</TableCell>
                  <TableCell>{getPriorityBadge(request.priority)}</TableCell>
                  <TableCell>{getStatusBadge(request.status)}</TableCell>
                  <TableCell className="text-sm">{request.reportedBy}</TableCell>
                  <TableCell className="text-sm">
                    {new Date(request.reportedDate).toLocaleDateString()}
                    {request.resolvedDate && (
                      <div className="text-xs text-green-600">
                        Resolved: {new Date(request.resolvedDate).toLocaleDateString()}
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
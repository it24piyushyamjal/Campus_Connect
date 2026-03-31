import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  BookOpen,
  Calendar,
  FileText,
  Users,
  MessageSquare,
  Award,
  Clock,
  Activity,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

type Trend = 'up' | 'warning' | 'neutral';

interface QuickStat {
  title: string;
  value: string;
  change: string;
  trend: Trend;
  icon: any;
  color: string;
}

interface ActivityItem {
  id: string;
  title: string;
  time: string;
  icon: any;
  color: string;
  createdAt: string;
}

interface UpcomingTask {
  id: string;
  title: string;
  dueDate: string;
  priority: 'high' | 'medium' | 'low';
  course: string;
}

const formatRelativeTime = (isoDate: string) => {
  const date = new Date(isoDate);
  const diffMs = Date.now() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

  if (diffHours < 1) return 'Just now';
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;

  return date.toLocaleDateString();
};

const formatDueDate = (isoDate: string) => {
  const due = new Date(isoDate);
  const now = new Date();
  const days = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (days <= 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  return `In ${days} days`;
};

const getPriorityFromDueDate = (isoDate: string): 'high' | 'medium' | 'low' => {
  const due = new Date(isoDate);
  const now = new Date();
  const days = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (days <= 2) return 'high';
  if (days <= 5) return 'medium';
  return 'low';
};

export default function Dashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [quickStats, setQuickStats] = useState<QuickStat[]>([]);
  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([]);
  const [upcomingTasks, setUpcomingTasks] = useState<UpcomingTask[]>([]);

  useEffect(() => {
    if (user) {
      fetchDashboardData();
    }
  }, [user]);

  const fetchDashboardData = async () => {
    if (!user) return;

    setLoading(true);
    const today = new Date().toISOString().slice(0, 10);

    try {
      const assignmentsQuery =
        user.role === 'student'
          ? supabase
              .from('assignments')
              .select('id, title, subject, due_date, created_at')
              .eq('class', user.className || 'IT-A')
          : supabase
              .from('assignments')
              .select('id, title, subject, due_date, created_at')
              .eq('assigned_by', user.id);

      const forumQuery =
        user.role === 'student'
          ? supabase.from('doubts').select('id, title, created_at', { count: 'exact' }).eq('author_id', user.id)
          : supabase.from('doubts').select('id, title, created_at', { count: 'exact' });

      const notesQuery =
        user.role === 'student'
          ? supabase.from('notes').select('id, title, created_at', { count: 'exact' })
          : supabase.from('notes').select('id, title, created_at', { count: 'exact' }).eq('author_id', user.id);

      const attendanceQuery =
        user.role === 'student'
          ? supabase.from('attendance').select('status').eq('student_id', user.id)
          : supabase.from('attendance').select('status');

      const upcomingAssignmentsQuery =
        user.role === 'student'
          ? supabase
              .from('assignments')
              .select('id, title, subject, due_date')
              .eq('class', user.className || 'IT-A')
              .gte('due_date', today)
              .order('due_date', { ascending: true })
              .limit(3)
          : supabase
              .from('assignments')
              .select('id, title, subject, due_date')
              .eq('assigned_by', user.id)
              .gte('due_date', today)
              .order('due_date', { ascending: true })
              .limit(3);

      const [
        { data: assignmentsData, error: assignmentsError },
        { data: notesData, count: notesCount, error: notesError },
        { data: doubtsData, count: doubtsCount, error: doubtsError },
        { data: attendanceData, error: attendanceError },
        { data: upcomingData, error: upcomingError },
      ] = await Promise.all([
        assignmentsQuery,
        notesQuery,
        forumQuery,
        attendanceQuery,
        upcomingAssignmentsQuery,
      ]);

      if (assignmentsError || notesError || doubtsError || attendanceError || upcomingError) {
        throw new Error('Failed to load dashboard data');
      }

      const assignmentsDueCount = (assignmentsData || []).filter((assignment) => assignment.due_date >= today).length;

      const totalAttendance = (attendanceData || []).length;
      const attendedCount = (attendanceData || []).filter((entry) => entry.status !== 'absent').length;
      const attendanceRate = totalAttendance > 0 ? Math.round((attendedCount / totalAttendance) * 100) : 0;

      setQuickStats([
        {
          title: 'Notes Shared',
          value: String(notesCount || 0),
          change: user.role === 'faculty' ? 'By you' : 'Available',
          trend: 'up',
          icon: BookOpen,
          color: 'text-primary',
        },
        {
          title: 'Assignments Due',
          value: String(assignmentsDueCount),
          change: 'Upcoming',
          trend: 'warning',
          icon: FileText,
          color: 'text-warning',
        },
        {
          title: 'Attendance Rate',
          value: `${attendanceRate}%`,
          change: totalAttendance > 0 ? `${attendedCount}/${totalAttendance}` : 'No records',
          trend: 'up',
          icon: Users,
          color: 'text-accent',
        },
        {
          title: 'Forum Posts',
          value: String(doubtsCount || 0),
          change: user.role === 'faculty' ? 'Campus wide' : 'By you',
          trend: 'neutral',
          icon: MessageSquare,
          color: 'text-secondary',
        },
      ]);

      const assignmentActivity = (assignmentsData || []).slice(0, 3).map((assignment) => ({
        id: `assignment-${assignment.id}`,
        title: `Assignment updated: ${assignment.title}`,
        time: formatRelativeTime(assignment.created_at),
        icon: FileText,
        color: 'text-warning',
        createdAt: assignment.created_at,
      }));

      const notesActivity = (notesData || []).slice(0, 3).map((note) => ({
        id: `note-${note.id}`,
        title: `Note shared: ${note.title}`,
        time: formatRelativeTime(note.created_at),
        icon: BookOpen,
        color: 'text-primary',
        createdAt: note.created_at,
      }));

      const doubtsActivity = (doubtsData || []).slice(0, 3).map((doubt) => ({
        id: `doubt-${doubt.id}`,
        title: `Doubt posted: ${doubt.title}`,
        time: formatRelativeTime(doubt.created_at),
        icon: MessageSquare,
        color: 'text-secondary',
        createdAt: doubt.created_at,
      }));

      const mergedActivity = [...assignmentActivity, ...notesActivity, ...doubtsActivity]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 4);

      setRecentActivity(mergedActivity);

      const tasks = (upcomingData || []).map((assignment) => ({
        id: assignment.id,
        title: assignment.title,
        dueDate: formatDueDate(assignment.due_date),
        priority: getPriorityFromDueDate(assignment.due_date),
        course: assignment.subject,
      }));

      setUpcomingTasks(tasks);
    } catch (error) {
      setQuickStats([
        {
          title: 'Notes Shared',
          value: '0',
          change: 'Unavailable',
          trend: 'neutral',
          icon: BookOpen,
          color: 'text-primary',
        },
        {
          title: 'Assignments Due',
          value: '0',
          change: 'Unavailable',
          trend: 'neutral',
          icon: FileText,
          color: 'text-warning',
        },
        {
          title: 'Attendance Rate',
          value: '0%',
          change: 'Unavailable',
          trend: 'neutral',
          icon: Users,
          color: 'text-accent',
        },
        {
          title: 'Forum Posts',
          value: '0',
          change: 'Unavailable',
          trend: 'neutral',
          icon: MessageSquare,
          color: 'text-secondary',
        },
      ]);
      setRecentActivity([]);
      setUpcomingTasks([]);
    } finally {
      setLoading(false);
    }
  };

  const safeUserFirstName = useMemo(() => user?.name?.split(' ')[0] || 'there', [user]);

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'destructive';
      case 'medium': return 'warning';
      case 'low': return 'secondary';
      default: return 'secondary';
    }
  };

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">
          Welcome back, {safeUserFirstName}! 👋
        </h1>
        <p className="text-muted-foreground">
          Here's what's happening with your campus activities today.
        </p>
      </div>

      {loading && (
        <Card>
          <CardContent className="py-8 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </CardContent>
        </Card>
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {quickStats.map((stat) => (
          <Card key={stat.title} className="bg-gradient-card">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    {stat.title}
                  </p>
                  <p className="text-2xl font-bold">{stat.value}</p>
                  <p className={`text-xs ${stat.color}`}>
                    {stat.change}
                  </p>
                </div>
                <stat.icon className={`h-8 w-8 ${stat.color}`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Clock className="h-5 w-5" />
              <span>Recent Activity</span>
            </CardTitle>
            <CardDescription>
              Your latest campus interactions
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {recentActivity.length > 0 ? (
              recentActivity.map((activity) => (
                <div key={activity.id} className="flex items-start space-x-3">
                  <activity.icon className={`h-5 w-5 mt-0.5 ${activity.color}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{activity.title}</p>
                    <p className="text-xs text-muted-foreground">{activity.time}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
                <Activity className="h-4 w-4 mr-2" />
                No recent activity yet
              </div>
            )}
            <Button variant="outline" className="w-full" asChild>
              <Link to="/doubts">View All Activity</Link>
            </Button>
          </CardContent>
        </Card>

        {/* Upcoming Tasks */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <AlertCircle className="h-5 w-5" />
              <span>Upcoming Tasks</span>
            </CardTitle>
            <CardDescription>
              Don't miss these important deadlines
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {upcomingTasks.length > 0 ? (
              upcomingTasks.map((task) => (
                <div key={task.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex-1">
                    <p className="text-sm font-medium">{task.title}</p>
                    <p className="text-xs text-muted-foreground">{task.course}</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge variant={getPriorityColor(task.priority) as any}>
                      {task.priority}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {task.dueDate}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-sm text-muted-foreground py-3">No upcoming tasks</div>
            )}
            <Button variant="outline" className="w-full" asChild>
              <Link to="/assignments">View All Assignments</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>
            Access your most used features
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Button variant="outline" className="h-20 flex-col space-y-2" asChild>
              <Link to="/notes">
                <BookOpen className="h-6 w-6" />
                <span>Share Notes</span>
              </Link>
            </Button>
            <Button variant="outline" className="h-20 flex-col space-y-2" asChild>
              <Link to="/timetable">
                <Calendar className="h-6 w-6" />
                <span>View Schedule</span>
              </Link>
            </Button>
            <Button variant="outline" className="h-20 flex-col space-y-2" asChild>
              <Link to="/doubts">
                <MessageSquare className="h-6 w-6" />
                <span>Ask Doubts</span>
              </Link>
            </Button>
            {user?.role === 'student' && (
              <Button variant="outline" className="h-20 flex-col space-y-2" asChild>
                <Link to="/certificates">
                  <Award className="h-6 w-6" />
                  <span>Certificates</span>
                </Link>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
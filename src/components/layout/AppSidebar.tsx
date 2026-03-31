import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  BookOpen,
  Calendar,
  FileText,
  Users,
  MessageSquare,
  Wrench,
  Home,
  LogOut,
  GraduationCap,
} from 'lucide-react';

const studentMenuItems = [
  { title: 'Dashboard', url: '/', icon: Home },
  { title: 'Notes Sharing', url: '/notes', icon: BookOpen },
  { title: 'Timetable', url: '/timetable', icon: Calendar },
  { title: 'Assignments', url: '/assignments', icon: FileText },
  { title: 'Attendance', url: '/attendance', icon: Users },
  { title: 'Doubt Forum', url: '/doubts', icon: MessageSquare },
  { title: 'Maintenance', url: '/maintenance', icon: Wrench },
];

const facultyMenuItems = [
  { title: 'Dashboard', url: '/', icon: Home },
  { title: 'Notes Sharing', url: '/notes', icon: BookOpen },
  { title: 'Timetable', url: '/timetable', icon: Calendar },
  { title: 'Assignments', url: '/assignments', icon: FileText },
  { title: 'Attendance', url: '/attendance', icon: Users },
  { title: 'Doubt Forum', url: '/doubts', icon: MessageSquare },
  { title: 'Maintenance', url: '/maintenance', icon: Wrench },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const { user, logout } = useAuth();
  const location = useLocation();
  const collapsed = state === 'collapsed';
  
  const menuItems = user?.role === 'faculty' ? facultyMenuItems : studentMenuItems;
  
  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  const getNavClass = (path: string) =>
    isActive(path) 
      ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium" 
      : "hover:bg-sidebar-accent/50";

  return (
    <Sidebar className="border-r">
      <SidebarHeader className="border-b p-4">
        <div className="flex items-center space-x-3">
          <GraduationCap className="h-8 w-8 text-sidebar-primary" />
          {!collapsed && (
            <div>
              <h1 className="font-bold text-lg">CampusConnect</h1>
              <p className="text-xs text-sidebar-foreground/70">Education Hub</p>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Main Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink 
                      to={item.url} 
                      className={getNavClass(item.url)}
                      end={item.url === '/'}
                    >
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Avatar className="h-8 w-8">
              <AvatarImage src={user?.avatar} />
              <AvatarFallback className="bg-primary text-primary-foreground">
                {user?.name.split(' ').map(n => n[0]).join('')}
              </AvatarFallback>
            </Avatar>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{user?.name}</p>
                <p className="text-xs text-sidebar-foreground/70 capitalize">
                  {user?.role}
                  {user?.className && ` • ${user.className}`}
                </p>
              </div>
            )}
          </div>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={logout}
            className="h-8 w-8 p-0"
            title="Logout"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
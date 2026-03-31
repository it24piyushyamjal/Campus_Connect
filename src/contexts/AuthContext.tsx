import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import type { User as SupabaseUser } from '@supabase/supabase-js';

export type UserRole = 'student' | 'faculty';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
  className?: string;
}

interface UserProfile {
  id: string;
  email: string | null;
  full_name: string | null;
  role: string | null;
  class: string | null;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  login: (email: string, password: string) => Promise<{ error: any }>;
  signup: (email: string, password: string, name: string, role: UserRole) => Promise<{ error: any }>;
  logout: () => void;
  isAuthenticated: boolean;
  isLoading: boolean;
  loading: boolean;
  selectClass: (className: string) => Promise<{ error: any }>;
  availableClasses: string[];
  needsClassSelection: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const availableClasses = ['IT-A', 'IT-B', 'CSE-A', 'CSE-B'];

const normalizeRole = (role: unknown): UserRole => {
  return role === 'faculty' ? 'faculty' : 'student';
};

const mapToUser = (supabaseUser: SupabaseUser, profile?: any): User => ({
  id: supabaseUser.id,
  name:
    profile?.full_name ||
    (supabaseUser.user_metadata?.full_name as string) ||
    supabaseUser.email?.split('@')[0] ||
    'User',
  email: profile?.email || supabaseUser.email || '',
  role: normalizeRole(profile?.role ?? supabaseUser.user_metadata?.role),
  className: profile?.class || supabaseUser.user_metadata?.class,
});

const withTimeout = async <T,>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
    }),
  ]);
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProfileResolved, setIsProfileResolved] = useState(false);
  const profileRequestRef = useRef(0);

  const clearAuthState = useCallback(() => {
    setUser(null);
    setProfile(null);
  }, []);

  const loadUserProfile = useCallback(async (supabaseUser: SupabaseUser) => {
    const requestId = ++profileRequestRef.current;

    try {
      const { data: foundProfile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', supabaseUser.id)
        .maybeSingle<UserProfile>();

      if (requestId !== profileRequestRef.current) {
        return;
      }

      if (error) {
        console.error('Error loading profile:', error);
        setProfile(null);
        setUser(mapToUser(supabaseUser));
        return;
      }

      if (!foundProfile) {
        const fallbackName =
          (supabaseUser.user_metadata?.full_name as string) ||
          supabaseUser.email?.split('@')[0] ||
          'User';
        const fallbackRole = normalizeRole(supabaseUser.user_metadata?.role);

        const { error: insertError } = await supabase.from('profiles').upsert(
          {
            id: supabaseUser.id,
            email: supabaseUser.email,
            full_name: fallbackName,
            role: fallbackRole,
          },
          { onConflict: 'id' }
        );

        if (insertError) {
          console.warn('Profile missing and could not be created from client:', insertError);
          setProfile(null);
          setUser(mapToUser(supabaseUser));
          return;
        }

        const { data: createdProfile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', supabaseUser.id)
          .maybeSingle<UserProfile>();

        if (requestId !== profileRequestRef.current) {
          return;
        }

        setProfile(createdProfile || null);
        setUser(mapToUser(supabaseUser, createdProfile));
        return;
      }

      setProfile(foundProfile);
      setUser(mapToUser(supabaseUser, foundProfile));
    } catch (error) {
      console.error('Error loading user profile:', error);
      setProfile(null);
      setUser(mapToUser(supabaseUser));
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    const initializeAuth = async () => {
      setIsLoading(true);
      setIsProfileResolved(false);
      try {
        // Read session exactly once on app initialization.
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          await withTimeout(
            loadUserProfile(session.user),
            7000,
            'Timed out while loading user profile during session restore'
          );
        } else {
          clearAuthState();
          if (isMounted) {
            setIsProfileResolved(true);
          }
        }
      } catch (error) {
        console.error('Error getting auth session:', error);
        if (isMounted) {
          clearAuthState();
          setIsProfileResolved(true);
        }
      } finally {
        if (isMounted) {
          setIsProfileResolved(true);
          setIsLoading(false);
        }
      }
    };

    initializeAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!isMounted || event === 'INITIAL_SESSION') {
          return;
        }

        try {
          if (session?.user) {
            setIsProfileResolved(false);
            await withTimeout(
              loadUserProfile(session.user),
              7000,
              'Timed out while loading user profile after auth state change'
            );
            if (isMounted) {
              setIsProfileResolved(true);
            }
          } else {
            clearAuthState();
            if (isMounted) {
              setIsProfileResolved(true);
            }
          }
        } catch (error) {
          console.error('Error handling auth state change:', error);
          if (session?.user) {
            setProfile(null);
            setUser(mapToUser(session.user));
          } else {
            clearAuthState();
          }
          if (isMounted) {
            setIsProfileResolved(true);
          }
        } finally {
          if (isMounted) {
            setIsLoading(false);
          }
        }
      }
    );

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [clearAuthState, loadUserProfile]);

  const login = async (email: string, password: string): Promise<{ error: any }> => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return { error };
      }

      return { error: null };
    } catch (error) {
      return { error };
    }
  };

  const signup = async (email: string, password: string, name: string, role: UserRole): Promise<{ error: any }> => {
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: name,
            role: role,
          },
        },
      });

      return { error };
    } catch (error) {
      return { error };
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    clearAuthState();
  };

  const selectClass = async (className: string): Promise<{ error: any }> => {
    if (!user) {
      return { error: new Error('User not authenticated') };
    }

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ class: className })
        .eq('id', user.id);

      if (error) {
        return { error };
      }

      setProfile((previousProfile) => {
        if (!previousProfile) {
          return previousProfile;
        }

        return {
          ...previousProfile,
          class: className,
        };
      });
      setUser((previousUser) => (previousUser ? { ...previousUser, className } : previousUser));
      return { error: null };
    } catch (error) {
      console.error('Error updating class:', error);
      return { error };
    }
  };

  const needsClassSelection =
    !isLoading &&
    isProfileResolved &&
    profile?.role === 'student' &&
    !profile?.class;

  const value = {
    user,
    profile,
    login,
    signup,
    logout,
    isAuthenticated: !!user,
    isLoading,
    loading: isLoading,
    selectClass,
    availableClasses,
    needsClassSelection,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
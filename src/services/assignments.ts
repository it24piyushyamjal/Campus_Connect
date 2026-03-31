import { supabase } from '../lib/supabase';

export interface Assignment {
  id: string;
  title: string;
  description?: string;
  subject: string;
  due_date: string;
  max_marks?: number;
  assigned_by: string;
  class: string;
  created_at: string;
  updated_at: string;
}

export interface Submission {
  id: string;
  assignment_id: string;
  student_id: string;
  submission_date: string;
  attachments?: any[];
  marks?: number;
  feedback?: string;
  created_at: string;
  updated_at: string;
}

export const assignmentsApi = {
  // Get all assignments for a class
  async getAssignments(className: string): Promise<{ data: Assignment[] | null; error: any }> {
    const { data, error } = await supabase
      .from('assignments')
      .select('*')
      .eq('class', className)
      .order('due_date', { ascending: true });

    return { data, error };
  },

  // Create a new assignment
  async createAssignment(assignment: Omit<Assignment, 'id' | 'created_at' | 'updated_at'>): Promise<{ data: Assignment | null; error: any }> {
    const { data, error } = await supabase
      .from('assignments')
      .insert(assignment)
      .select()
      .single();

    return { data, error };
  },

  // Update an assignment
  async updateAssignment(id: string, updates: Partial<Assignment>): Promise<{ data: Assignment | null; error: any }> {
    const { data, error } = await supabase
      .from('assignments')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    return { data, error };
  },

  // Delete an assignment
  async deleteAssignment(id: string): Promise<{ error: any }> {
    const { error } = await supabase
      .from('assignments')
      .delete()
      .eq('id', id);

    return { error };
  },

  // Get submissions for an assignment
  async getSubmissions(assignmentId: string): Promise<{ data: Submission[] | null; error: any }> {
    const { data, error } = await supabase
      .from('submissions')
      .select(`
        *,
        profiles:student_id (
          full_name,
          email
        )
      `)
      .eq('assignment_id', assignmentId)
      .order('submission_date', { ascending: false });

    return { data, error };
  },

  // Submit an assignment
  async submitAssignment(submission: Omit<Submission, 'id' | 'created_at' | 'updated_at' | 'submission_date'>): Promise<{ data: Submission | null; error: any }> {
    const { data, error } = await supabase
      .from('submissions')
      .insert({
        ...submission,
        submission_date: new Date().toISOString(),
      })
      .select()
      .single();

    return { data, error };
  },

  // Grade a submission
  async gradeSubmission(submissionId: string, marks: number, feedback?: string): Promise<{ data: Submission | null; error: any }> {
    const { data, error } = await supabase
      .from('submissions')
      .update({ marks, feedback })
      .eq('id', submissionId)
      .select()
      .single();

    return { data, error };
  },

  // Get student's submissions
  async getStudentSubmissions(studentId: string): Promise<{ data: Submission[] | null; error: any }> {
    const { data, error } = await supabase
      .from('submissions')
      .select(`
        *,
        assignments (
          title,
          subject,
          due_date,
          max_marks
        )
      `)
      .eq('student_id', studentId)
      .order('submission_date', { ascending: false });

    return { data, error };
  },
};
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
  BookOpen,
  Upload,
  Search,
  Filter,
  Download,
  Eye,
  Calendar,
  User,
  Plus,
  Pencil,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface Note {
  id: string;
  title: string;
  description: string;
  subject: string;
  author: string;
  authorRole: 'student' | 'faculty';
  uploadDate: string;
  views: number;
  rating: number;
  tags: string[];
  fileSize: string;
  fileType: string;
  author_id: string;
  file_url: string | null;
  created_at: string;
}

interface NoteProfile {
  full_name: string | null;
  role: 'student' | 'faculty' | string | null;
}

interface NoteRow {
  id: string;
  title: string;
  description: string | null;
  subject: string;
  author_name?: string | null;
  file_url: string | null;
  tags: string[] | null;
  views: number | null;
  rating: number | null;
  created_at: string;
  author_id: string;
  profiles: NoteProfile | NoteProfile[] | null;
}

const subjects = ['All Subjects', 'Data Structures', 'Database Systems', 'Operating Systems', 'Computer Networks', 'Software Engineering'];

export default function NotesSharing() {
  const { user } = useAuth();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('All Subjects');
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStage, setUploadStage] = useState<'idle' | 'uploading-file' | 'creating-note'>('idle');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editUploadError, setEditUploadError] = useState<string | null>(null);
  const [editSelectedFile, setEditSelectedFile] = useState<File | null>(null);
  const [deletingNoteId, setDeletingNoteId] = useState<string | null>(null);
  const [downloadingNoteId, setDownloadingNoteId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const editFileInputRef = useRef<HTMLInputElement | null>(null);

  // New note form state
  const [newNote, setNewNote] = useState({
    title: '',
    description: '',
    subject: '',
    tags: '',
  });

  const [editNoteForm, setEditNoteForm] = useState({
    title: '',
    description: '',
    subject: '',
    tags: '',
  });

  const getFileTypeFromUrl = (url: string | null) => {
    if (!url) return 'N/A';
    const lowerUrl = url.toLowerCase();
    if (lowerUrl.endsWith('.pdf')) return 'PDF';
    if (lowerUrl.endsWith('.png') || lowerUrl.endsWith('.jpg') || lowerUrl.endsWith('.jpeg') || lowerUrl.endsWith('.gif') || lowerUrl.endsWith('.webp')) return 'Image';
    if (lowerUrl.endsWith('.doc') || lowerUrl.endsWith('.docx')) return 'DOC';
    return 'File';
  };

  const getFileNameFromUrl = (url: string | null) => {
    if (!url) {
      return 'download';
    }

    try {
      const pathname = new URL(url).pathname;
      const lastSegment = decodeURIComponent(pathname.split('/').pop() || 'download');
      return lastSegment.replace(/^\d+-/, '');
    } catch {
      const pathWithoutQuery = url.split('?')[0];
      const lastSegment = decodeURIComponent(pathWithoutQuery.split('/').pop() || 'download');
      return lastSegment.replace(/^\d+-/, '');
    }
  };

  const getPreviewUrl = (url: string | null) => {
    if (!url) {
      return '#';
    }

    try {
      const parsedUrl = new URL(url);
      parsedUrl.searchParams.delete('download');
      return parsedUrl.toString();
    } catch {
      return url.replace(/([?&])download=[^&]*(&?)/, (_match, prefix, suffix) => {
        if (prefix === '?' && suffix) return '?';
        if (prefix === '&' && suffix) return '&';
        return '';
      }).replace(/[?&]$/, '');
    }
  };

  const getDownloadUrl = (url: string | null) => {
    if (!url) {
      return '#';
    }

    const fileName = getFileNameFromUrl(url);

    try {
      const parsedUrl = new URL(url);
      parsedUrl.searchParams.set('download', fileName);
      return parsedUrl.toString();
    } catch {
      const baseUrl = getPreviewUrl(url);
      const separator = baseUrl.includes('?') ? '&' : '?';
      return `${baseUrl}${separator}download=${encodeURIComponent(fileName)}`;
    }
  };

  const getStoragePathFromPublicUrl = (url: string | null) => {
    if (!url) {
      return null;
    }

    try {
      const parsedUrl = new URL(url);
      const marker = '/storage/v1/object/public/notes/';
      const markerIndex = parsedUrl.pathname.indexOf(marker);

      if (markerIndex === -1) {
        return null;
      }

      return decodeURIComponent(parsedUrl.pathname.slice(markerIndex + marker.length));
    } catch {
      return null;
    }
  };

  const getStoragePathCandidates = (url: string | null) => {
    const storagePath = getStoragePathFromPublicUrl(url);

    if (!storagePath) {
      return [];
    }

    return [
      storagePath,
      storagePath.startsWith('notes/') ? storagePath.slice('notes/'.length) : `notes/${storagePath}`,
    ].filter((path, index, array) => path && array.indexOf(path) === index);
  };

  const formatFileSize = (sizeInBytes: number) => {
    if (!Number.isFinite(sizeInBytes) || sizeInBytes <= 0) {
      return 'N/A';
    }

    const units = ['B', 'KB', 'MB', 'GB'];
    let normalizedSize = sizeInBytes;
    let unitIndex = 0;

    while (normalizedSize >= 1024 && unitIndex < units.length - 1) {
      normalizedSize /= 1024;
      unitIndex += 1;
    }

    const decimals = unitIndex === 0 ? 0 : 1;
    return `${normalizedSize.toFixed(decimals)} ${units[unitIndex]}`;
  };

  const resolveFileSize = async (url: string | null) => {
    if (!url) {
      return 'N/A';
    }

    try {
      const response = await fetch(getPreviewUrl(url), { method: 'HEAD' });
      const headerValue = response.headers.get('content-length');
      const parsedSize = headerValue ? Number(headerValue) : NaN;

      if (Number.isFinite(parsedSize) && parsedSize > 0) {
        return formatFileSize(parsedSize);
      }
    } catch {
      // ignore and fallback
    }

    return 'N/A';
  };

  const canManageNote = (note: Note) => {
    return user?.role === 'faculty' && user.id === note.author_id;
  };

  const createSignedFileUrl = async (url: string | null, downloadFileName?: string) => {
    const candidatePaths = getStoragePathCandidates(url);

    if (candidatePaths.length === 0) {
      throw new Error('Invalid file path');
    }

    let lastErrorMessage = 'Unable to access file';

    for (const candidatePath of candidatePaths) {
      const { data, error } = await supabase.storage
        .from('notes')
        .createSignedUrl(candidatePath, 300, downloadFileName ? { download: downloadFileName } : undefined);

      if (!error && data?.signedUrl) {
        return data.signedUrl;
      }

      if (error?.message) {
        lastErrorMessage = error.message;
      }
    }

    throw new Error(lastErrorMessage);
  };

  const incrementViews = async (note: Note) => {
    const nextViews = (note.views || 0) + 1;

    setNotes((previousNotes) => previousNotes.map((existingNote) => (
      existingNote.id === note.id ? { ...existingNote, views: nextViews } : existingNote
    )));

    const { error: updateError } = await supabase
      .from('notes')
      .update({ views: nextViews })
      .eq('id', note.id);

    if (updateError) {
      setNotes((previousNotes) => previousNotes.map((existingNote) => (
        existingNote.id === note.id ? { ...existingNote, views: note.views } : existingNote
      )));
    }
  };

  const handleDownloadNote = async (note: Note) => {
    try {
      setDownloadingNoteId(note.id);
      const signedUrl = await createSignedFileUrl(note.file_url, getFileNameFromUrl(note.file_url));

      const linkElement = document.createElement('a');
      linkElement.href = signedUrl;
      linkElement.download = getFileNameFromUrl(note.file_url);
      document.body.appendChild(linkElement);
      linkElement.click();
      document.body.removeChild(linkElement);
      await incrementViews(note);
    } catch (err) {
      if (note.file_url) {
        const fallbackLinkElement = document.createElement('a');
        fallbackLinkElement.href = getDownloadUrl(note.file_url);
        fallbackLinkElement.download = getFileNameFromUrl(note.file_url);
        document.body.appendChild(fallbackLinkElement);
        fallbackLinkElement.click();
        document.body.removeChild(fallbackLinkElement);
        await incrementViews(note);
        return;
      }

      const errorMessage = err instanceof Error ? err.message : 'Failed to download file';
      toast.error(errorMessage);
    } finally {
      setDownloadingNoteId(null);
    }
  };

  const toRoleLabel = (role: string) => role.charAt(0).toUpperCase() + role.slice(1);

  const isMissingAuthorNameColumnError = (message: string) => {
    const normalizedMessage = message.toLowerCase();
    return normalizedMessage.includes('column notes.author_name does not exist');
  };

  // Fetch notes from Supabase and map them to the existing UI model.
  const fetchNotes = async (showLoadingState = true) => {
    try {
      if (showLoadingState) {
        setLoading(true);
      }
      setError(null);

      let noteRows: NoteRow[] = [];

      const { data, error: fetchError } = await supabase
        .from('notes')
        .select('id, title, description, subject, author_name, file_url, tags, views, rating, created_at, author_id, profiles(full_name, role)')
        .order('created_at', { ascending: false });

      if (fetchError) {
        if (isMissingAuthorNameColumnError(fetchError.message)) {
          const { data: legacyData, error: legacyFetchError } = await supabase
            .from('notes')
            .select('id, title, description, subject, file_url, tags, views, rating, created_at, author_id, profiles(full_name, role)')
            .order('created_at', { ascending: false });

          if (legacyFetchError) {
            throw new Error(legacyFetchError.message);
          }

          noteRows = (legacyData as NoteRow[]) || [];
        } else {
          throw new Error(fetchError.message);
        }
      } else {
        noteRows = (data as NoteRow[]) || [];
      }

      const mappedNotes: Note[] = noteRows.map((note) => {
        const profile = Array.isArray(note.profiles) ? note.profiles[0] : note.profiles;
        const normalizedRole = profile?.role === 'faculty' ? 'faculty' : 'student';

        return {
        id: note.id,
        title: note.title,
        description: note.description || '',
        subject: note.subject,
        author: profile?.full_name || note.author_name || 'Unknown',
        authorRole: normalizedRole,
        uploadDate: new Date(note.created_at).toISOString().split('T')[0],
        views: note.views || 0,
        rating: Number(note.rating || 0),
        tags: note.tags || [],
        fileSize: 'N/A',
        fileType: getFileTypeFromUrl(note.file_url),
        author_id: note.author_id,
        file_url: note.file_url,
        created_at: note.created_at,
      };
      });

      setNotes(mappedNotes);

      const noteSizes = await Promise.all(mappedNotes.map(async (note) => ({
        id: note.id,
        fileSize: await resolveFileSize(note.file_url),
      })));

      setNotes((previousNotes) => previousNotes.map((note) => {
        const sizeEntry = noteSizes.find((item) => item.id === note.id);
        return sizeEntry ? { ...note, fileSize: sizeEntry.fileSize } : note;
      }));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load notes';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      if (showLoadingState) {
        setLoading(false);
      }
    }
  };

  // Initial load when component mounts.
  useEffect(() => {
    fetchNotes();
  }, []);

  const filteredNotes = notes.filter(note => {
    const matchesSearch = note.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         note.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         note.author.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSubject = selectedSubject === 'All Subjects' || note.subject === selectedSubject;
    return matchesSearch && matchesSubject;
  });

  // Create a new note in Supabase and refresh the list.
  const handleUploadNote = async () => {
    if (!newNote.title || !newNote.subject) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (!user) {
      toast.error('Please sign in to upload notes.');
      return;
    }

    if (user.role !== 'faculty') {
      toast.error('Only faculty users can upload notes.');
      return;
    }

    try {
      setIsUploading(true);
      setUploadError(null);
      setUploadStage('creating-note');

      // Validate uploader role from profiles table.
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (profileError) {
        throw new Error(profileError.message);
      }

      if (profile?.role !== 'faculty') {
        throw new Error('Only faculty users can upload notes.');
      }

      let fileUrl: string | null = null;

      // Upload selected file to Supabase Storage if provided.
      if (selectedFile) {
        setUploadStage('uploading-file');
        const originalFileName = selectedFile.name.replace(/[\\/]/g, '_');
        const filePath = `notes/${user.id}/${Date.now()}/${originalFileName}`;

        const { error: storageError } = await supabase.storage
          .from('notes')
          .upload(filePath, selectedFile, {
            contentType: selectedFile.type || undefined,
          });

        if (storageError) {
          const rawStorageMessage = storageError.message || 'File upload failed.';
          const isRlsError = rawStorageMessage.toLowerCase().includes('row-level security');

          if (isRlsError) {
            const friendlyMessage = 'File upload is blocked by storage permissions. Note will be created without an attachment.';
            setUploadError(friendlyMessage);
            toast.error(friendlyMessage);
          } else {
            throw new Error(rawStorageMessage);
          }
        } else {
          const { data: publicUrlData } = supabase.storage
            .from('notes')
            .getPublicUrl(filePath);

          fileUrl = publicUrlData.publicUrl;
        }
      }

      setUploadStage('creating-note');

      // Insert the note row while preserving existing insert flow.
      const noteInsertPayload = {
        title: newNote.title,
        description: newNote.description,
        subject: newNote.subject,
        author_id: user.id,
        file_url: fileUrl,
      };

      let { error: insertError } = await supabase.from('notes').insert({
        ...noteInsertPayload,
        author_name: user.name,
      });

      if (insertError && isMissingAuthorNameColumnError(insertError.message)) {
        const fallbackInsert = await supabase.from('notes').insert(noteInsertPayload);
        insertError = fallbackInsert.error;
      }

      if (insertError) {
        const rawInsertMessage = insertError.message || 'Failed to create note';
        const isRlsError = rawInsertMessage.toLowerCase().includes('row-level security');
        if (isRlsError) {
          throw new Error('Insert blocked by database policy. Please ensure you are signed in as faculty and your profile is linked to this auth user.');
        }
        throw new Error(rawInsertMessage);
      }

      toast.success('Note created successfully.');
      setNewNote((prev) => ({ ...prev, title: '', description: '', subject: '' }));
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      setIsUploadOpen(false);

      // Refresh notes so latest item appears instantly.
      await fetchNotes(false);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create note';
      setUploadError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsUploading(false);
      setUploadStage('idle');
    }
  };

  const openEditDialog = (note: Note) => {
    if (!canManageNote(note)) {
      return;
    }

    setEditingNote(note);
    setEditNoteForm({
      title: note.title,
      description: note.description,
      subject: note.subject,
      tags: note.tags.join(', '),
    });
    setEditUploadError(null);
    setEditSelectedFile(null);
    if (editFileInputRef.current) {
      editFileInputRef.current.value = '';
    }
    setIsEditOpen(true);
  };

  const handleEditDialogOpenChange = (open: boolean) => {
    setIsEditOpen(open);

    if (!open) {
      setEditingNote(null);
      setEditUploadError(null);
      setEditSelectedFile(null);
      setEditNoteForm({
        title: '',
        description: '',
        subject: '',
        tags: '',
      });
      if (editFileInputRef.current) {
        editFileInputRef.current.value = '';
      }
    }
  };

  const handleSaveEdit = async () => {
    if (!editingNote) {
      return;
    }

    if (!editNoteForm.title || !editNoteForm.subject) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (!canManageNote(editingNote)) {
      toast.error('You can only edit your own uploaded notes.');
      return;
    }

    try {
      setIsSavingEdit(true);
      setEditUploadError(null);

      let updatedFileUrl = editingNote.file_url;

      if (editSelectedFile && user) {
        const originalFileName = editSelectedFile.name.replace(/[\\/]/g, '_');
        const filePath = `notes/${user.id}/${Date.now()}/${originalFileName}`;

        const { error: storageError } = await supabase.storage
          .from('notes')
          .upload(filePath, editSelectedFile, {
            contentType: editSelectedFile.type || undefined,
          });

        if (storageError) {
          const rawStorageMessage = storageError.message || 'File upload failed.';
          const isRlsError = rawStorageMessage.toLowerCase().includes('row-level security');

          if (isRlsError) {
            const friendlyMessage = 'File upload is blocked by storage permissions.';
            setEditUploadError(friendlyMessage);
            throw new Error(friendlyMessage);
          }

          throw new Error(rawStorageMessage);
        }

        const { data: publicUrlData } = supabase.storage
          .from('notes')
          .getPublicUrl(filePath);

        updatedFileUrl = publicUrlData.publicUrl;
      }

      const { error: updateError } = await supabase
        .from('notes')
        .update({
          title: editNoteForm.title,
          description: editNoteForm.description,
          subject: editNoteForm.subject,
          file_url: updatedFileUrl,
        })
        .eq('id', editingNote.id)
        .eq('author_id', user?.id || '');

      if (updateError) {
        throw new Error(updateError.message);
      }

      if (editSelectedFile && updatedFileUrl !== editingNote.file_url) {
        const previousStoragePath = getStoragePathFromPublicUrl(editingNote.file_url);
        if (previousStoragePath) {
          const { error: removeFileError } = await supabase.storage
            .from('notes')
            .remove([previousStoragePath]);

          if (removeFileError) {
            console.warn('Note updated but old file could not be removed:', removeFileError.message);
          }
        }
      }

      toast.success('Note updated successfully.');
      handleEditDialogOpenChange(false);
      await fetchNotes(false);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update note';
      toast.error(errorMessage);
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleDeleteNote = async (note: Note) => {
    if (!canManageNote(note)) {
      toast.error('You can only delete your own uploaded notes.');
      return;
    }

    try {
      setDeletingNoteId(note.id);

      const { error: deleteError } = await supabase
        .from('notes')
        .delete()
        .eq('id', note.id)
        .eq('author_id', user?.id || '');

      if (deleteError) {
        throw new Error(deleteError.message);
      }

      const storagePath = getStoragePathFromPublicUrl(note.file_url);
      if (storagePath) {
        const { error: removeFileError } = await supabase.storage
          .from('notes')
          .remove([storagePath]);

        if (removeFileError) {
          console.warn('Note deleted but attached file could not be removed:', removeFileError.message);
        }
      }

      toast.success('Note deleted successfully.');
      await fetchNotes(false);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete note';
      toast.error(errorMessage);
    } finally {
      setDeletingNoteId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center space-x-2">
            <BookOpen className="h-8 w-8" />
            <span>Notes Sharing</span>
          </h1>
          <p className="text-muted-foreground">
            Share and discover study materials from your peers and faculty
          </p>
        </div>
        
        {user?.role === 'faculty' && (
          <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
            <DialogTrigger asChild>
              <Button className="flex items-center space-x-2">
                <Plus className="h-4 w-4" />
                <span>Upload Notes</span>
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Upload New Notes</DialogTitle>
                <DialogDescription>
                  Share your study materials with the campus community
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Title *</Label>
                  <Input
                    id="title"
                    placeholder="Enter note title"
                    value={newNote.title}
                    onChange={(e) => setNewNote({ ...newNote, title: e.target.value })}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="subject">Subject *</Label>
                  <Select value={newNote.subject} onValueChange={(value) => setNewNote({ ...newNote, subject: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select subject" />
                    </SelectTrigger>
                    <SelectContent>
                      {subjects.slice(1).map((subject) => (
                        <SelectItem key={subject} value={subject}>
                          {subject}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    placeholder="Brief description of the notes"
                    value={newNote.description}
                    onChange={(e) => setNewNote({ ...newNote, description: e.target.value })}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="tags">Tags (comma-separated)</Label>
                  <Input
                    id="tags"
                    placeholder="algorithms, examples, theory"
                    value={newNote.tags}
                    onChange={(e) => setNewNote({ ...newNote, tags: e.target.value })}
                  />
                </div>

                {uploadError && (
                  <p className="text-sm text-destructive">{uploadError}</p>
                )}
                
                <div className="space-y-2">
                  <Label htmlFor="file">File Upload</Label>
                  <div className="border-2 border-dashed border-muted rounded-lg p-6 text-center">
                    <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">
                      Click to upload or drag and drop
                    </p>
                    <p className="text-xs text-muted-foreground">
                      PDF, DOC, DOCX up to 10MB
                    </p>
                    <Input
                      id="file"
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.doc,.docx,.ppt,.pptx,.txt"
                      className="mt-4"
                      onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                    />
                    {selectedFile && (
                      <p className="text-xs text-muted-foreground mt-2">
                        Selected: {selectedFile.name}
                      </p>
                    )}
                  </div>
                </div>
                
                <div className="flex space-x-2 pt-4">
                  <Button onClick={handleUploadNote} className="flex-1" disabled={isUploading}>
                    {isUploading
                      ? uploadStage === 'uploading-file'
                        ? 'Uploading file...'
                        : 'Creating...'
                      : 'Upload Notes'}
                  </Button>
                  <Button variant="outline" onClick={() => setIsUploadOpen(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search notes by title, author, or content..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-11 text-sm"
              />
            </div>

            <div className="w-full md:w-56">
              <Select value={selectedSubject} onValueChange={setSelectedSubject}>
                <SelectTrigger className="h-11 text-sm">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {subjects.map((subject) => (
                    <SelectItem key={subject} value={subject}>
                      {subject}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isEditOpen} onOpenChange={handleEditDialogOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Note</DialogTitle>
            <DialogDescription>
              Update your uploaded note details.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-title">Title *</Label>
              <Input
                id="edit-title"
                placeholder="Enter note title"
                value={editNoteForm.title}
                onChange={(e) => setEditNoteForm((prev) => ({ ...prev, title: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-subject">Subject *</Label>
              <Select
                value={editNoteForm.subject}
                onValueChange={(value) => setEditNoteForm((prev) => ({ ...prev, subject: value }))}
              >
                <SelectTrigger id="edit-subject">
                  <SelectValue placeholder="Select subject" />
                </SelectTrigger>
                <SelectContent>
                  {subjects.slice(1).map((subject) => (
                    <SelectItem key={subject} value={subject}>
                      {subject}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                placeholder="Brief description of the notes"
                value={editNoteForm.description}
                onChange={(e) => setEditNoteForm((prev) => ({ ...prev, description: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-tags">Tags (comma-separated)</Label>
              <Input
                id="edit-tags"
                placeholder="algorithms, examples, theory"
                value={editNoteForm.tags}
                onChange={(e) => setEditNoteForm((prev) => ({ ...prev, tags: e.target.value }))}
              />
            </div>

            {editUploadError && (
              <p className="text-sm text-destructive">{editUploadError}</p>
            )}

            <div className="space-y-2">
              <Label htmlFor="edit-file">File Upload</Label>
              <div className="border-2 border-dashed border-muted rounded-lg p-6 text-center">
                <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  Click to upload or drag and drop
                </p>
                <p className="text-xs text-muted-foreground">
                  PDF, DOC, DOCX up to 10MB
                </p>
                <Input
                  id="edit-file"
                  ref={editFileInputRef}
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.doc,.docx,.ppt,.pptx,.txt"
                  className="mt-4"
                  onChange={(e) => setEditSelectedFile(e.target.files?.[0] || null)}
                />
                {editSelectedFile ? (
                  <p className="text-xs text-muted-foreground mt-2">
                    Selected: {editSelectedFile.name}
                  </p>
                ) : editingNote?.file_url ? (
                  <p className="text-xs text-muted-foreground mt-2">
                    Current: {getFileNameFromUrl(editingNote.file_url)}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="flex space-x-2 pt-2">
              <Button className="flex-1" onClick={handleSaveEdit} disabled={isSavingEdit}>
                {isSavingEdit ? 'Saving...' : 'Save Changes'}
              </Button>
              <Button variant="outline" onClick={() => handleEditDialogOpenChange(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Error State */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-6">
            <p className="text-red-700 font-medium">Error loading notes</p>
            <p className="text-sm text-red-600 mt-2">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Notes Grid */}
      {loading ? (
        <div className="flex justify-center items-center py-12">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
            <p className="text-muted-foreground">Loading notes...</p>
          </div>
        </div>
      ) : filteredNotes.length === 0 ? (
        <div className="text-center py-12">
          <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium">No notes found</h3>
          <p className="text-muted-foreground">
            Try adjusting your search terms or filters
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredNotes.map((note) => (
            <Card key={note.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg line-clamp-2">{note.title}</CardTitle>
                    <CardDescription className="mt-2">
                      {note.description}
                    </CardDescription>
                  </div>
                  <Badge variant={'default'}>
                    {toRoleLabel(note.authorRole)}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Tags */}
                  <div className="flex flex-wrap gap-1">
                    {note.tags.map((tag) => (
                      <Badge key={tag} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>

                  {/* Metadata */}
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center space-x-1">
                        <User className="h-4 w-4" />
                        <span>{note.author}</span>
                      </span>
                      <span className="flex items-center space-x-1">
                        <Calendar className="h-4 w-4" />
                        <span>{new Date(note.uploadDate).toLocaleDateString()}</span>
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-end">
                      <span>{note.fileSize} • {note.fileType}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex space-x-2">
                    {note.file_url ? (
                      <>
                        {user?.role === 'student' && (
                          <Button size="sm" variant="outline" className="flex-1" asChild>
                            <a href={getPreviewUrl(note.file_url)}>
                              <Eye className="h-4 w-4 mr-2" />
                              Preview
                            </a>
                          </Button>
                        )}
                        <Button
                          size="sm"
                          className="flex-1"
                          onClick={() => handleDownloadNote(note)}
                          disabled={downloadingNoteId === note.id}
                        >
                          <Download className="h-4 w-4 mr-2" />
                          {downloadingNoteId === note.id ? 'Downloading...' : 'Download'}
                        </Button>
                      </>
                    ) : (
                      <Button size="sm" variant="outline" className="flex-1" disabled>
                        <Eye className="h-4 w-4 mr-2" />
                        No file attached
                      </Button>
                    )}
                  </div>

                  {canManageNote(note) && (
                    <div className="flex space-x-2">
                      <Button size="sm" variant="outline" className="flex-1" onClick={() => openEditDialog(note)}>
                        <Pencil className="h-4 w-4 mr-2" />
                        Edit
                      </Button>

                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="destructive" className="flex-1" disabled={deletingNoteId === note.id}>
                            <Trash2 className="h-4 w-4 mr-2" />
                            {deletingNoteId === note.id ? 'Deleting...' : 'Delete'}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete this note?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This action cannot be undone. The note and its attached file will be removed.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDeleteNote(note)}>
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type UserProfile = {
  id: string;
  email: string;
  full_name?: string | null;
  avatar_url?: string | null;
  created_at?: string;
};

export type Project = {
  id: string;
  user_id: string;
  name: string;
  description?: string | null;
  color?: string | null;
  icon?: string | null;
  total_size?: number;
  file_count?: number;
  created_at?: string;
  updated_at?: string;
};

export type FolderNode = {
  id: string;
  project_id: string;
  name: string;
  parent_id?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type FileNode = {
  id: string;
  project_id: string;
  folder_id?: string | null;
  name: string;
  size?: number;
  mime_type?: string | null;
  extension?: string | null;
  storage_path: string;
  thumbnail_path?: string | null;
  checksum?: string | null;
  is_trashed?: boolean;
  trashed_at?: string | null;
  last_accessed_at?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type SharedLink = {
  id: string;
  file_id: string;
  token: string;
  expires_at?: string | null;
  download_count?: number;
  created_by: string;
  created_at?: string;
};

export type Device = {
  id: string;
  user_id: string;
  device_name: string;
  device_type?: string;
  last_sync_at?: string | null;
  is_active?: boolean;
  created_at?: string;
};

export type ActivityLog = {
  id: string;
  user_id: string;
  project_id?: string | null;
  action: string;
  file_id?: string | null;
  details?: Json;
  created_at?: string;
};

export type AppRelease = {
  id: string;
  version: string;
  release_notes?: string | null;
  download_url: string;
  file_size?: number;
  checksum?: string | null;
  is_latest?: boolean;
  created_at?: string;
};

export type UploadItem = {
  id: string;
  file: File;
  projectId: string;
  folderId?: string | null;
  progress: number;
  status: 'pending' | 'uploading' | 'success' | 'error';
  error?: string | null;
};

export type AuthFormValues = {
  email: string;
  password: string;
  full_name?: string;
};

export type ProjectFormValues = {
  name: string;
  description?: string;
  color?: string;
  icon?: string;
};

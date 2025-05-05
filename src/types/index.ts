export interface User {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  updatedAt: string;
}

export interface CachedFilesData {
  files: File[];
  source: string | null;
}

export interface CachedFoldersData {
  folders: Folder[];
  source: string | null;
}

export interface File {
  _id: string;
  name: string;
  type: string;
  size: number;
  path: string;
  folderId: string | null;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Folder {
  _id: string;
  name: string;
  parentId: string | null;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

export interface ApiError {
  message: string;
  status: number;
}

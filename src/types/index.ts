export interface User {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  updatedAt: string;
  encryptedMasterKey?: string; // Renamed and aligned with server
  storageLimit?: number; // New
  storageUsed?: number; // New
  avatarUrl?: string; // Added for user avatar
}

export interface MyFileType {
  _id: string;
  name: string;
  type: string;
  size: number;
  path: string; // This 'path' is server-side OS path, not URL path
  folderId: string | null;
  userId: string;
  createdAt: string;
  updatedAt: string;
  isStarred?: boolean;
  displayPath?: string; // Added
  trashedAt?: string | null; // Added
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

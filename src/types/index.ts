
export interface User {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  updatedAt: string;
  avatar: string | null;
  storageUsed: number;
  storageLimit: number;
  storageType: string;
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
  isStarred: boolean;
  isTrash: boolean;
  thumbnailPath: string | null;
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

export interface StorageInfo {
  storageUsed: number;
  storageLimit: number;
  storageType: string;
  usagePercentage: number;
}

export interface StoragePlan {
  id: string;
  name: string;
  size: number;
  unit: string;
  price: number;
}

export interface ViewMode {
  mode: 'grid' | 'list';
}

export interface FileViewProps {
  file: File;
  onClose: () => void;
  onNext?: () => void;
  onPrevious?: () => void;
  hasNext?: boolean;
  hasPrevious?: boolean;
}


export interface User {
  id: string;
  name: string;
  email: string;
  storageUsed: number;
  storageLimit: number;
  storageType: string;
  bucketId: string;
  avatar: string | null;
  encryptedMasterKey: string;
  salt: string;
  iv: string;
  tag: string;
  createdAt: string;
  updatedAt: string;
}

export interface File {
  _id: string;
  name: string;
  originalName?: string;
  type: string;
  size: number;
  path: string;
  thumbnailPath: string | null;
  thumbnailCache?: string | null;
  folderId: string | null;
  userId: string;
  isStarred: boolean;
  isTrash: boolean;
  encryptionIV?: string;
  metadataEncrypted?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Folder {
  _id: string;
  name: string;
  originalName?: string;
  userId: string;
  parentId: string | null;
  isTrash: boolean;
  metadataEncrypted?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StorageInfo {
  storageUsed: number;
  storageLimit: number;
  storageType: string;
  usagePercentage: number;
}

export interface FolderItemProps {
  folder: Folder;
  onClick: () => void;
  onDelete: () => void;
  viewMode?: 'grid' | 'list';
}

export interface FileViewProps {
  file: File;
  onClose: () => void;
  onNext?: () => void;
  onPrevious?: () => void;
  hasNext?: boolean;
  hasPrevious?: boolean;
}

export interface FilesToolbarProps {
  currentFolder: Folder | null;
  onNavigateUp: () => void;
  onCreateFolder: (name: string) => void;
  onUploadFiles: (files: FileList) => void;
  isUploading: boolean;
  uploadProgress: number;
  reloadFilesAndFolders: () => void;
  isTrashView: boolean;
  storageInfo?: StorageInfo | null;
}

export interface PlanOption {
  id: string;
  name: string;
  description: string;
  price: number;
  features: string[];
  storageGB: number;
  recommended?: boolean;
}

export interface CachedFilesData {
  files: File[];
  source?: string;
}

export interface UploadingFile {
  id: string;
  file: File;
  progress: number;
  status: 'encrypting' | 'uploading' | 'complete' | 'error';
  error?: string;
}

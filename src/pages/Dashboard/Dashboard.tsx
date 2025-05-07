
// Import necessary components for file type definitions
import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { filesApi, foldersApi } from '@/services/api';
import { File, Folder, StorageInfo, UploadingFile } from '@/types';
import { useNavigate, useParams } from 'react-router-dom';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink } from '@/components/ui/breadcrumb';
import { Alert } from '@/components/ui/alert';
import { useToast } from '@/components/ui/use-toast';
import { AlertCircle, Folder as FolderIcon, Home } from 'lucide-react';
import FileGrid from '@/components/files/FileGrid';
import FilesEmptyState from '@/components/files/FilesEmptyState';
import FilesToolbar from '@/components/files/FilesToolbar';
import FilePreviewDialog from '@/components/files/FilePreviewDialog';
import FileUploadProgress from '@/components/files/FileUploadProgress';
import { v4 as uuidv4 } from 'uuid';

const Dashboard: React.FC = () => {
  const { token, user, masterKey } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { folderId } = useParams();
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [currentFolder, setCurrentFolder] = useState<Folder | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<Folder[]>([]);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedFileIndex, setSelectedFileIndex] = useState<number>(-1);
  const [storageInfo, setStorageInfo] = useState<StorageInfo | null>(null);
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  
  // Load storage info
  useEffect(() => {
    const loadStorageInfo = async () => {
      if (!token) return;
      
      try {
        const info = await filesApi.getStorageInfo(token);
        setStorageInfo(info);
      } catch (error) {
        console.error('Error loading storage info:', error);
      }
    };
    
    loadStorageInfo();
  }, [token]);
  
  // Load folders and files when folder ID changes
  useEffect(() => {
    const loadFolderContents = async () => {
      if (!token || !user) return;
      
      setIsLoading(true);
      setError(null);
      
      try {
        // Get current folder details if folderId is provided
        if (folderId) {
          const response = await foldersApi.getFolders(token, folderId);
          const currentFolder = response.folders.find(f => f._id === folderId);
          if (currentFolder) {
            setCurrentFolder(currentFolder);
          } else {
            throw new Error('Folder not found');
          }
        } else {
          setCurrentFolder(null);
        }
        
        // Load folders
        const foldersResponse = await foldersApi.getFolders(token, folderId || null);
        
        // For folders with encrypted names, decrypt them
        let processedFolders = foldersResponse.folders;
        if (masterKey) {
          processedFolders = foldersResponse.folders.map(folder => {
            // If metadata is encrypted and we have a master key, decrypt the name
            if (folder.metadataEncrypted && masterKey) {
              const decryptedName = userEncryptionService.decryptName(folder.name, masterKey);
              return {
                ...folder,
                originalName: decryptedName || folder.name
              };
            }
            return folder;
          });
        }
        
        setFolders(processedFolders);
        
        // Load files
        const filesResponse = await filesApi.getFiles(token, folderId || null);
        setFiles(filesResponse.files);
        
        // Build breadcrumbs
        await buildBreadcrumbs(folderId);
        
      } catch (error: any) {
        console.error('Error loading folder contents:', error);
        setError(error?.message || 'Failed to load folder contents');
        if (error?.status === 404) {
          navigate('/dashboard');
        }
      } finally {
        setIsLoading(false);
      }
    };
    
    loadFolderContents();
  }, [token, user, folderId, navigate, masterKey]);
  
  // Build breadcrumbs for navigation
  const buildBreadcrumbs = async (folderId: string | undefined) => {
    if (!token || !folderId) {
      setBreadcrumbs([]);
      return;
    }
    
    try {
      const breadcrumbList: Folder[] = [];
      let currentId = folderId;
      
      // Traverse up the folder tree
      while (currentId) {
        const response = await foldersApi.getFolders(token, currentId);
        const folder = response.folders.find(f => f._id === currentId);
        
        if (folder) {
          breadcrumbList.unshift(folder);
          currentId = folder.parentId || '';
        } else {
          break;
        }
      }
      
      setBreadcrumbs(breadcrumbList);
    } catch (error) {
      console.error('Error building breadcrumbs:', error);
    }
  };
  
  // Handle file upload
  const handleFileUpload = async (fileList: FileList) => {
    if (!token || !user || !fileList.length) return;
    
    const files = Array.from(fileList);
    const totalSize = files.reduce((sum, file) => sum + file.size, 0);
    
    // First check if we have enough storage
    try {
      const { hasSpace, storageInfo } = await filesApi.checkStorageQuota(token, totalSize);
      
      if (!hasSpace) {
        const remainingSpace = storageInfo.storageLimit - storageInfo.storageUsed;
        toast({
          title: "Storage quota exceeded",
          description: `You need ${(totalSize / (1024 * 1024)).toFixed(2)} MB but only have ${(remainingSpace / (1024 * 1024)).toFixed(2)} MB available.`,
          variant: "destructive"
        });
        return;
      }
      
      // Create uploading files records
      const newUploadingFiles: UploadingFile[] = files.map(file => ({
        id: uuidv4(),
        file,
        progress: 0,
        status: 'encrypting'
      }));
      
      setUploadingFiles(prev => [...prev, ...newUploadingFiles]);
      
      // Update progress per file
      const handleProgress = (fileId: string, progress: number) => {
        setUploadingFiles(prev => 
          prev.map(f => f.id === fileId ? { ...f, progress } : f)
        );
      };
      
      // Update file status
      const handleFileStatus = (fileId: string, status: UploadingFile['status'], error?: string) => {
        setUploadingFiles(prev => 
          prev.map(f => f.id === fileId ? { ...f, status, error } : f)
        );
      };
      
      // Upload the files
      const uploadedFiles = await filesApi.multipleFileUpload({
        token,
        files: files as unknown as Blob[],
        folderId: folderId || null,
        masterKey: masterKey || '',
        userId: user.id,
        onProgress: handleProgress,
        onFileStatusChange: handleFileStatus
      });
      
      // Refresh the file list
      const filesResponse = await filesApi.getFiles(token, folderId || null, true);
      setFiles(filesResponse.files);
      
      // Update storage info
      const info = await filesApi.getStorageInfo(token);
      setStorageInfo(info);
      
      toast({
        title: "Upload complete",
        description: `Successfully uploaded ${uploadedFiles.length} files`
      });
      
    } catch (error: any) {
      console.error('Error uploading files:', error);
      toast({
        title: "Upload failed",
        description: error?.message || 'Failed to upload files',
        variant: "destructive"
      });
    }
  };
  
  // Create a new folder
  const handleCreateFolder = async (name: string) => {
    if (!token || !user) return;
    
    try {
      // Encrypt folder name if we have a master key
      const folderName = masterKey ? userEncryptionService.encryptName(name, masterKey) : name;
      
      // Create the folder
      const newFolder = await foldersApi.createFolder(
        token, 
        folderName, 
        folderId || null, 
        user.id,
        !!masterKey // metadataEncrypted flag
      );
      
      // Add decrypted name for display
      const folderWithOriginalName = masterKey ? {
        ...newFolder,
        originalName: name
      } : newFolder;
      
      // Update the folders list
      setFolders(prev => [...prev, folderWithOriginalName]);
      
      toast({
        title: "Folder created",
        description: `Created folder: ${name}`
      });
    } catch (error: any) {
      console.error('Error creating folder:', error);
      toast({
        title: "Failed to create folder",
        description: error?.message || 'An error occurred',
        variant: "destructive"
      });
    }
  };
  
  // Navigate up to parent folder
  const handleNavigateUp = async () => {
    if (!currentFolder?.parentId) {
      navigate('/dashboard');
    } else {
      navigate(`/dashboard/folder/${currentFolder.parentId}`);
    }
  };
  
  // Star/unstar a file
  const handleStarFile = async (file: File) => {
    if (!token) return;
    
    try {
      const { isStarred } = await filesApi.starFile(token, file._id);
      
      // Update the file in the list
      setFiles(prev => 
        prev.map(f => f._id === file._id ? { ...f, isStarred } : f)
      );
      
      toast({
        title: isStarred ? "File starred" : "File unstarred",
      });
    } catch (error) {
      console.error('Error starring file:', error);
      toast({
        title: "Action failed",
        description: "Failed to update file",
        variant: "destructive"
      });
    }
  };
  
  // Move file to trash
  const handleTrashFile = async (file: File) => {
    if (!token) return;
    
    try {
      await filesApi.trashFile(token, file._id);
      
      // Remove the file from the list
      setFiles(prev => prev.filter(f => f._id !== file._id));
      
      toast({
        title: "File moved to trash",
      });
    } catch (error) {
      console.error('Error trashing file:', error);
      toast({
        title: "Action failed",
        description: "Failed to move file to trash",
        variant: "destructive"
      });
    }
  };
  
  // Delete file permanently
  const handleDeleteFile = async (file: File) => {
    if (!token) return;
    
    try {
      await filesApi.deleteFile(token, file._id);
      
      // Remove the file from the list
      setFiles(prev => prev.filter(f => f._id !== file._id));
      
      toast({
        title: "File deleted permanently",
      });
    } catch (error) {
      console.error('Error deleting file:', error);
      toast({
        title: "Action failed",
        description: "Failed to delete file",
        variant: "destructive"
      });
    }
  };
  
  // Restore file from trash
  const handleRestoreFile = async (file: File) => {
    if (!token) return;
    
    try {
      await filesApi.restoreFile(token, file._id);
      
      // If we're in the trash view, remove the file from the list
      setFiles(prev => prev.filter(f => f._id !== file._id));
      
      toast({
        title: "File restored",
      });
    } catch (error) {
      console.error('Error restoring file:', error);
      toast({
        title: "Action failed",
        description: "Failed to restore file",
        variant: "destructive"
      });
    }
  };
  
  // Open file preview
  const handleOpenFile = (file: File, index: number) => {
    setSelectedFile(file);
    setSelectedFileIndex(index);
  };
  
  // Navigate to next file
  const handleNextFile = () => {
    if (selectedFileIndex < files.length - 1) {
      setSelectedFile(files[selectedFileIndex + 1]);
      setSelectedFileIndex(selectedFileIndex + 1);
    }
  };
  
  // Navigate to previous file
  const handlePreviousFile = () => {
    if (selectedFileIndex > 0) {
      setSelectedFile(files[selectedFileIndex - 1]);
      setSelectedFileIndex(selectedFileIndex - 1);
    }
  };
  
  // Dismiss uploading file
  const handleDismissFile = (fileId: string) => {
    setUploadingFiles(prev => prev.filter(file => file.id !== fileId));
  };
  
  // Dismiss all uploading files
  const handleDismissAllFiles = () => {
    setUploadingFiles([]);
  };
  
  return (
    <div className="flex flex-col h-full">
      {/* Breadcrumb navigation */}
      <div className="p-2 border-b">
        <Breadcrumb>
          <BreadcrumbItem>
            <BreadcrumbLink href="/dashboard" className="flex items-center">
              <Home className="mr-1 h-4 w-4" />
              Home
            </BreadcrumbLink>
          </BreadcrumbItem>
          {breadcrumbs.map((folder, index) => (
            <BreadcrumbItem key={folder._id}>
              <BreadcrumbLink 
                href={`/dashboard/folder/${folder._id}`}
                className="flex items-center"
              >
                {index === 0 && <FolderIcon className="mr-1 h-4 w-4" />}
                {folder.metadataEncrypted && masterKey
                  ? userEncryptionService.decryptName(folder.name, masterKey)
                  : folder.name}
              </BreadcrumbLink>
            </BreadcrumbItem>
          ))}
        </Breadcrumb>
      </div>
      
      {/* Error message */}
      {error && (
        <div className="p-4">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <span className="ml-2">{error}</span>
          </Alert>
        </div>
      )}
      
      {/* Toolbar */}
      <FilesToolbar 
        currentFolder={currentFolder}
        onNavigateUp={handleNavigateUp}
        onCreateFolder={handleCreateFolder}
        onUploadFiles={handleFileUpload}
        onViewModeChange={setViewMode}
        viewMode={viewMode}
      />
      
      {/* File grid or empty state */}
      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            <p className="mt-4 text-sm text-muted-foreground">Loading files...</p>
          </div>
        </div>
      ) : folders.length === 0 && files.length === 0 ? (
        <FilesEmptyState 
          onCreateFolder={handleCreateFolder}
          onUploadFiles={handleFileUpload}
        />
      ) : (
        <FileGrid
          folders={folders}
          files={files}
          viewMode={viewMode}
          onOpenFolder={(folderId) => navigate(`/dashboard/folder/${folderId}`)}
          onOpenFile={handleOpenFile}
          onStarFile={handleStarFile}
          onTrashFile={handleTrashFile}
          onDeleteFile={handleDeleteFile}
          onRestoreFile={handleRestoreFile}
          masterKey={masterKey}
        />
      )}
      
      {/* File preview dialog */}
      {selectedFile && (
        <FilePreviewDialog
          file={selectedFile}
          onClose={() => setSelectedFile(null)}
          onNext={hasNext ? handleNextFile : undefined}
          onPrevious={hasPrevious ? handlePreviousFile : undefined}
          hasNext={selectedFileIndex < files.length - 1}
          hasPrevious={selectedFileIndex > 0}
        />
      )}
      
      {/* File upload progress */}
      {uploadingFiles.length > 0 && (
        <FileUploadProgress
          uploadingFiles={uploadingFiles}
          onDismissFile={handleDismissFile}
          onDismissAll={handleDismissAllFiles}
        />
      )}
    </div>
  );
};

// Add missing import
import { userEncryptionService } from '@/services/api/userEncryption';

export default Dashboard;

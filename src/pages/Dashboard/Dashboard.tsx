
import FileGrid from "@/components/files/FileGrid";
import FilesEmptyState from "@/components/files/FilesEmptyState";
import FilesToolbar from "@/components/files/FilesToolbar";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { filesApi, foldersApi } from "@/services/api";
import { File, Folder, StorageInfo } from "@/types";
import { useEffect, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Grid, List, Search } from "lucide-react";
import ProfileDialog from "@/components/profile/ProfileDialog";
import { Input } from "@/components/ui/input";

const Dashboard = () => {
  const { user, token } = useAuth();
  const { toast } = useToast();
  const location = useLocation();
  const params = useParams();
  const [files, setFiles] = useState<File[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentFolder, setCurrentFolder] = useState<Folder | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [storageInfo, setStorageInfo] = useState<StorageInfo | null>(null);

  // Determine what type of files to load based on the route
  const getFileType = (): string => {
    const path = location.pathname;
    if (path.includes('/starred')) return 'starred';
    if (path.includes('/trash')) return 'trash';
    if (path.includes('/search')) return 'search';
    return 'all';
  };

  const fileType = getFileType();
  const isTrashView = fileType === 'trash';
  const isSearchView = fileType === 'search';

  // Load storage info
  useEffect(() => {
    if (token) {
      loadStorageInfo();
    }
  }, [token]);

  const loadStorageInfo = async () => {
    if (!token) return;
    
    try {
      const info = await filesApi.getStorageInfo(token);
      setStorageInfo(info);
    } catch (error) {
      console.error("Error loading storage info:", error);
    }
  };

  useEffect(() => {
    if (token) {
      if (isSearchView && !searchQuery) {
        setFiles([]);
        setFolders([]);
        setLoading(false);
        return;
      }
      loadFilesAndFolders();
    }
  }, [token, currentFolder, fileType, searchQuery]);

  const loadFilesAndFolders = async ({
    resetCache = false,
  }: { resetCache?: boolean } = {}) => {
    setLoading(true);
    try {
      if (token && user) {
        if (isSearchView) {
          // Only load files for search, no folders
          const filesData = await filesApi.getFiles(token, null, true, 'all', searchQuery);
          setFiles(filesData?.files || []);
          setFolders([]);
        } else {
          const [filesData, foldersData] = await Promise.all([
            filesApi.getFiles(token, currentFolder?._id || null, resetCache, fileType),
            !isTrashView && !isSearchView ? foldersApi.getFolders(token, currentFolder?._id || null, resetCache, user.id) : { folders: [] },
          ]);

          setFiles(filesData?.files || []);
          setFolders(foldersData?.folders || []);
        }
      }
    } catch (error) {
      console.error("Error loading files and folders:", error);
      toast({
        title: "Error",
        description: "Failed to load your files and folders",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateFolder = async (name: string) => {
    if (!token || !user) return;

    try {
      await foldersApi.createFolder(
        token,
        name,
        currentFolder?._id || null,
        user.id
      );
      loadFilesAndFolders({ resetCache: true }).then(() => {
        toast({
          title: "Success",
          description: `Folder "${name}" created successfully`,
        });
      });
    } catch (error) {
      console.error("Error creating folder:", error);
      toast({
        title: "Error",
        description: "Failed to create folder",
        variant: "destructive",
      });
    }
  };

  const handleUploadFiles = async (fileList: FileList) => {
    if (!token || !user) return;
    if (!fileList || fileList.length === 0) return;

    setIsUploading(true);
    setUploadProgress(0);

    // Convert FileList to array for easier handling
    const files = Array.from(fileList);
    
    // Calculate total size to check quota
    const totalSize = files.reduce((sum, file) => sum + file.size, 0);
    
    try {
      // Check storage quota before uploading
      const { hasSpace, storageInfo: updatedStorage } = await filesApi.checkStorageQuota(token, totalSize);
      
      if (!hasSpace) {
        const remainingSpace = updatedStorage.storageLimit - updatedStorage.storageUsed;
        const requiredMB = (totalSize / (1024 * 1024)).toFixed(2);
        const availableMB = (remainingSpace / (1024 * 1024)).toFixed(2);
        
        toast({
          title: "Storage Quota Exceeded",
          description: `You need ${requiredMB} MB but only have ${availableMB} MB available.`,
          variant: "destructive",
        });
        
        setIsUploading(false);
        return;
      }
      
      await filesApi.multipleFileUpload({
        token,
        files,
        folderId: currentFolder?._id || null,
        setUploadProgress,
        setIsUploading,
        userId: user.id,
      });

      // Update storage info after successful upload
      await loadStorageInfo();
      
      loadFilesAndFolders({ resetCache: true }).then(() => {
        toast({
          title: "Success",
          description: `${files.length} ${files.length === 1 ? "file" : "files"} uploaded successfully`,
        });
      });
    } catch (error) {
      console.error("Error uploading files:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to upload files",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteFile = async (fileId: string) => {
    if (!token) return;

    try {
      await filesApi.deleteFile(token, fileId);
      setFiles((prev) => prev.filter((file) => file._id !== fileId));
      
      // Update storage info after deletion
      await loadStorageInfo();
      
      toast({
        title: "Success",
        description: "File deleted successfully",
      });
    } catch (error) {
      console.error("Error deleting file:", error);
      toast({
        title: "Error",
        description: "Failed to delete file",
        variant: "destructive",
      });
    }
  };

  const handleDeleteFolder = async (folderId: string) => {
    if (!token) return;

    try {
      await foldersApi.deleteFolder(token, folderId);
      loadFilesAndFolders({ resetCache: true });
      toast({
        title: "Success",
        description: "Folder deleted successfully",
      });
    } catch (error) {
      console.error("Error deleting folder:", error);
      toast({
        title: "Error",
        description: "Failed to delete folder",
        variant: "destructive",
      });
    }
  };

  const handleNavigateToFolder = (folder: Folder) => {
    setCurrentFolder(folder);
  };

  const handleNavigateUp = async () => {
    if (!currentFolder || !currentFolder.parentId || !token || !user) {
      setCurrentFolder(null);
      return;
    }

    try {
      const parentFolders = await foldersApi.getFolders(token, null, false, user.id);
      const parentFolder = parentFolders.folders?.find(
        (f) => f._id === currentFolder.parentId
      );
      setCurrentFolder(parentFolder || null);
    } catch (error) {
      console.error("Error navigating up:", error);
      setCurrentFolder(null);
    }
  };

  const handleFileStar = async (fileId: string) => {
    if (!token) return;

    try {
      const result = await filesApi.starFile(token, fileId);
      
      // Update the file in the state
      setFiles(prev => 
        prev.map(file => 
          file._id === fileId ? { ...file, isStarred: result.isStarred } : file
        )
      );
      
      toast({
        title: "Success",
        description: result.isStarred ? "File starred" : "File unstarred",
      });
    } catch (error) {
      console.error("Error starring file:", error);
      toast({
        title: "Error",
        description: "Failed to update file",
        variant: "destructive",
      });
    }
  };

  const handleFileTrash = async (fileId: string) => {
    if (!token) return;

    try {
      await filesApi.trashFile(token, fileId);
      
      // Remove the file from the current view
      setFiles(prev => prev.filter(file => file._id !== fileId));
      
      toast({
        title: "Success",
        description: "File moved to trash",
      });
    } catch (error) {
      console.error("Error trashing file:", error);
      toast({
        title: "Error",
        description: "Failed to move file to trash",
        variant: "destructive",
      });
    }
  };

  const handleFileRestore = async (fileId: string) => {
    if (!token) return;

    try {
      await filesApi.restoreFile(token, fileId);
      
      // Remove the file from trash view
      if (isTrashView) {
        setFiles(prev => prev.filter(file => file._id !== fileId));
      }
      
      toast({
        title: "Success",
        description: "File restored from trash",
      });
    } catch (error) {
      console.error("Error restoring file:", error);
      toast({
        title: "Error",
        description: "Failed to restore file from trash",
        variant: "destructive",
      });
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSearching(true);
    // The actual search is triggered by the useEffect when searchQuery changes
  };

  const getPageTitle = (): string => {
    if (isSearchView) return "Search Results";
    if (isTrashView) return "Trash";
    if (fileType === 'starred') return "Starred";
    if (currentFolder) return currentFolder.name;
    return "My Drive";
  };

  const toggleViewMode = () => {
    setViewMode(prev => prev === 'grid' ? 'list' : 'grid');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">
          {getPageTitle()}
        </h2>
        <div className="flex items-center gap-2">
          {isSearchView && (
            <form onSubmit={handleSearch} className="flex items-center">
              <Input
                type="text"
                placeholder="Search files..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-64 mr-2"
              />
              <Button type="submit" disabled={isSearching}>
                <Search className="h-4 w-4 mr-2" />
                Search
              </Button>
            </form>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleViewMode}
            title={viewMode === 'grid' ? 'Switch to list view' : 'Switch to grid view'}
          >
            {viewMode === 'grid' ? <List className="h-5 w-5" /> : <Grid className="h-5 w-5" />}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setIsProfileOpen(true)}>
            Profile
          </Button>
        </div>
      </div>

      {!isSearchView && (
        <FilesToolbar
          currentFolder={currentFolder}
          onNavigateUp={handleNavigateUp}
          onCreateFolder={handleCreateFolder}
          onUploadFiles={handleUploadFiles}
          isUploading={isUploading}
          uploadProgress={uploadProgress}
          reloadFilesAndFolders={() => {
            loadFilesAndFolders({ resetCache: true });
          }}
          isTrashView={isTrashView}
          storageInfo={storageInfo}
        />
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <Spinner className="h-12 w-12" />
        </div>
      ) : isSearchView && searchQuery === "" ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Enter a search term to find files</p>
        </div>
      ) : folders.length === 0 && files.length === 0 ? (
        <FilesEmptyState />
      ) : (
        <FileGrid
          folders={folders}
          files={files}
          onFolderClick={handleNavigateToFolder}
          onFileDelete={handleDeleteFile}
          onFolderDelete={handleDeleteFolder}
          onFileStar={handleFileStar}
          onFileTrash={handleFileTrash}
          onFileRestore={isTrashView ? handleFileRestore : undefined}
          viewMode={viewMode}
        />
      )}

      <ProfileDialog
        open={isProfileOpen}
        onOpenChange={setIsProfileOpen}
      />
    </div>
  );
};

export default Dashboard;


import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import { File, Folder } from "@/types";
import { filesApi, foldersApi } from "@/services/api";
import { Spinner } from "@/components/ui/Spinner";
import FileGrid from "@/components/files/FileGrid";
import FilesEmptyState from "@/components/files/FilesEmptyState";
import FilesToolbar from "@/components/files/FilesToolbar";

const Dashboard = () => {
  const { user, token } = useAuth();
  const { toast } = useToast();
  const [files, setFiles] = useState<File[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentFolder, setCurrentFolder] = useState<Folder | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    if (token) {
      loadFilesAndFolders();
    }
  }, [token, currentFolder]);

  const loadFilesAndFolders = async () => {
    setLoading(true);
    try {
      if (token) {
        const [filesData, foldersData] = await Promise.all([
          filesApi.getFiles(token, currentFolder?.id || null),
          foldersApi.getFolders(token, currentFolder?.id || null)
        ]);
        setFiles(filesData);
        setFolders(foldersData);
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
    if (!token) return;
    
    try {
      const newFolder = await foldersApi.createFolder(token, name, currentFolder?.id || null);
      setFolders(prev => [...prev, newFolder]);
      toast({
        title: "Success",
        description: `Folder "${name}" created successfully`,
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

  const handleUploadFiles = async (files: FileList) => {
    if (!token) return;
    
    setIsUploading(true);
    setUploadProgress(0);
    
    const totalFiles = files.length;
    let completedFiles = 0;
    
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const formData = new FormData();
        formData.append("file", file);
        
        await filesApi.uploadFile(token, formData, currentFolder?.id || null);
        
        completedFiles++;
        setUploadProgress(Math.round((completedFiles / totalFiles) * 100));
      }
      
      loadFilesAndFolders();
      
      toast({
        title: "Success",
        description: `${totalFiles} ${totalFiles === 1 ? "file" : "files"} uploaded successfully`,
      });
    } catch (error) {
      console.error("Error uploading files:", error);
      toast({
        title: "Error",
        description: "Failed to upload files",
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
      setFiles(prev => prev.filter(file => file.id !== fileId));
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
      setFolders(prev => prev.filter(folder => folder.id !== folderId));
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
    if (!currentFolder || !currentFolder.parentId || !token) {
      setCurrentFolder(null);
      return;
    }
    
    try {
      const parentFolders = await foldersApi.getFolders(token);
      const parentFolder = parentFolders.find(f => f.id === currentFolder.parentId);
      setCurrentFolder(parentFolder || null);
    } catch (error) {
      console.error("Error navigating up:", error);
      setCurrentFolder(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">
          {currentFolder ? currentFolder.name : "My Drive"}
        </h2>
      </div>

      <FilesToolbar 
        currentFolder={currentFolder} 
        onNavigateUp={handleNavigateUp}
        onCreateFolder={handleCreateFolder}
        onUploadFiles={handleUploadFiles}
        isUploading={isUploading}
        uploadProgress={uploadProgress}
      />

      {loading ? (
        <div className="flex justify-center py-12">
          <Spinner className="h-12 w-12" />
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
        />
      )}
    </div>
  );
};

export default Dashboard;

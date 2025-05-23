
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import { File, Folder } from "@/types";
import { filesApi, foldersApi } from "@/services/api";
import { encryptFile, decryptFile } from "@/lib/cryptoUtils";
import { Spinner } from "@/components/ui/Spinner";
import FileGrid from "@/components/files/FileGrid";
import FilesEmptyState from "@/components/files/FilesEmptyState";
import FilesToolbar from "@/components/files/FilesToolbar";
import FilePreviewDialog from "@/components/previews/FilePreviewDialog";

const Dashboard = () => {
  const { user, token, decryptedMasterKey } = useAuth();
  const { toast } = useToast();
  const [files, setFiles] = useState<File[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentFolder, setCurrentFolder] = useState<Folder | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [previewFileContent, setPreviewFileContent] = useState<ArrayBuffer | null>(null);
  const [previewFileMetadata, setPreviewFileMetadata] = useState<File | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);

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

  const handleFilePreview = async (fileToPreview: File) => {
    if (!token || !decryptedMasterKey) {
      toast({
        title: "Preview Error",
        description: "Cannot preview file: Essential authentication or key information is missing.",
        variant: "destructive"
      });
      return;
    }

    try {
      setIsPreviewLoading(true);
      toast({ title: "Loading preview...", description: `Fetching and decrypting ${fileToPreview.name}.` });

      const encryptedBlob = await filesApi.downloadFile(token, fileToPreview.id);
      const encryptedBuffer = await encryptedBlob.arrayBuffer();

      // Check if encryptedBuffer is empty or too small (as an extra precaution)
      if (encryptedBuffer.byteLength < 12) { // Minimum size for IV
        throw new Error("Downloaded file data is too short to be valid encrypted content.");
      }

      const decryptedBuffer = await decryptFile(encryptedBuffer, decryptedMasterKey);

      setPreviewFileContent(decryptedBuffer);
      setPreviewFileMetadata(fileToPreview);
      setIsPreviewing(true); // This will be used to trigger the dialog open state

    } catch (error) {
      console.error("Error preparing file preview:", error);
      toast({
        title: "Preview Error",
        description: `Could not load file for preview. ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive"
      });
      setPreviewFileContent(null); // Clear any stale preview data
      setPreviewFileMetadata(null);
      setIsPreviewing(false);
    } finally {
      setIsPreviewLoading(false);
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
    // token and decryptedMasterKey are now available from useAuth() in the component scope
    if (!token || !decryptedMasterKey) {
      toast({
        title: "Upload Error",
        description: "Cannot upload files: encryption key not available or not logged in.",
        variant: "destructive",
      });
      setIsUploading(false);
      return;
    }
    
    setIsUploading(true);
    setUploadProgress(0);
    
    const totalFiles = files.length;
    let completedFiles = 0;
    
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];

        // Read file to ArrayBuffer
        const fileReader = new FileReader();
        const fileBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
          fileReader.onload = () => resolve(fileReader.result as ArrayBuffer);
          fileReader.onerror = () => reject(fileReader.error);
          fileReader.readAsArrayBuffer(file);
        });

        // Encrypt the file buffer
        const { iv, ciphertext } = await encryptFile(fileBuffer, decryptedMasterKey);

        // Create the combined Blob
        const encryptedBlob = new Blob([iv, ciphertext]);
        
        // Call the updated filesApi.uploadFile
        await filesApi.uploadFile(token, encryptedBlob, file.name, currentFolder?.id || null); 
        
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
          onFilePreview={handleFilePreview}
        />
      )}

      {isPreviewLoading && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100]"> {/* Ensure high z-index */}
          <Spinner className="h-12 w-12 text-white" />
        </div>
      )}

      {previewFileMetadata && (
        <FilePreviewDialog
          isOpen={isPreviewing}
          onClose={() => {
            setIsPreviewing(false);
            setPreviewFileContent(null); // Clear content to free memory
            setPreviewFileMetadata(null); // Clear metadata
          }}
          fileContent={previewFileContent}
          fileName={previewFileMetadata.name}
          fileType={previewFileMetadata.type}
        />
      )}
    </div>
  );
};

export default Dashboard;

import UpgradeStorageDialog from "@/components/dialogs/UpgradeStorageDialog"; // Added
import FileGrid from "@/components/files/FileGrid";
import FilesEmptyState from "@/components/files/FilesEmptyState";
import FilesToolbar from "@/components/files/FilesToolbar";
import FilePreviewDialog from "@/components/previews/FilePreviewDialog";
import { Spinner } from "@/components/ui/Spinner";
import { ToastAction } from "@/components/ui/toast"; // Added
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { decryptFile, encryptFile } from "@/lib/cryptoUtils";
import { filesApi, foldersApi } from "@/services/api";
import { File, Folder } from "@/types";
import { useEffect, useState } from "react";

// Helper function for MIME type inference
const getAccurateMimeType = (file: globalThis.File): string => {
  const browserType = file.type;
  const fileName = file.name;

  // If browserType is specific and not generic, trust it
  if (
    browserType &&
    browserType !== "application/octet-stream" &&
    !browserType.endsWith("/unknown")
  ) {
    return browserType;
  }

  const extensionToMimeType: { [key: string]: string } = {
    // Images
    jpeg: "image/jpeg",
    jpg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    bmp: "image/bmp",
    webp: "image/webp",
    svg: "image/svg+xml",
    // Text
    txt: "text/plain",
    html: "text/html",
    css: "text/css",
    js: "application/javascript",
    json: "application/json",
    xml: "application/xml",
    md: "text/markdown",
    // Documents
    pdf: "application/pdf",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ppt: "application/vnd.ms-powerpoint",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    xls: "application/vnd.ms-excel",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    // Audio
    mp3: "audio/mpeg",
    wav: "audio/wav",
    ogg: "audio/ogg",
    // Video
    mp4: "video/mp4",
    webm: "video/webm",
    avi: "video/x-msvideo",
    // Archives
    zip: "application/zip",
    rar: "application/vnd.rar",
  };

  const extension = fileName.split(".").pop()?.toLowerCase() || "";

  // Prioritize extension map result if browserType was generic
  if (extension && extensionToMimeType[extension]) {
    return extensionToMimeType[extension];
  }

  // Fallback logic:
  // 1. Use browserType if it exists and wasn't 'application/octet-stream' (already handled by first if)
  //    or if it was 'application/octet-stream' but extension lookup failed.
  // 2. If browserType is empty and extension lookup failed, use 'application/octet-stream'.
  return browserType || "application/octet-stream";
};

const Dashboard = () => {
  const { user, token, getMasterCryptoKey } = useAuth(); // Changed
  const { toast } = useToast();
  const [files, setFiles] = useState<File[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentFolder, setCurrentFolder] = useState<Folder | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [previewFileContent, setPreviewFileContent] =
    useState<ArrayBuffer | null>(null);
  const [previewFileMetadata, setPreviewFileMetadata] = useState<File | null>(
    null
  );
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isUpgradeStorageDialogOpen, setIsUpgradeStorageDialogOpen] =
    useState(false); // Added state for dialog

  useEffect(() => {
    if (token) {
      loadFilesAndFolders();
    }
  }, [token, currentFolder, searchQuery]); // Added searchQuery

  const loadFilesAndFolders = async () => {
    setLoading(true);
    try {
      if (token) {
        // Pass searchQuery only to getFiles
        const [filesData, foldersData] = await Promise.all([
          filesApi.getFiles(token, currentFolder?._id || null, searchQuery),
          foldersApi.getFolders(token, currentFolder?._id || null),
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
    if (!token) {
      // Check for token first
      toast({
        title: "Preview Error",
        description: "Cannot preview file: Not authenticated.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsPreviewLoading(true);
      toast({
        title: "Loading preview...",
        description: `Fetching and decrypting ${fileToPreview.name}.`,
      });

      const encryptedBlob = await filesApi.downloadFile(
        token,
        fileToPreview._id
      );
      const encryptedBuffer = await encryptedBlob.arrayBuffer();

      // Check if encryptedBuffer is empty or too small (as an extra precaution)
      if (encryptedBuffer.byteLength < 12) {
        // Minimum size for IV
        throw new Error(
          "Downloaded file data is too short to be valid encrypted content."
        );
      }

      const cryptoKey = await getMasterCryptoKey(); // Call the async function from context
      if (!cryptoKey) {
        toast({
          title: "Decryption Key Error",
          description:
            "Decryption key is not available. You might need to log in again or ensure your session is active.",
          variant: "destructive",
        });
        setIsPreviewLoading(false); // Ensure loading state is reset
        return; // Stop further processing
      }

      const decryptedBuffer = await decryptFile(encryptedBuffer, cryptoKey); // Use the obtained cryptoKey

      setPreviewFileContent(decryptedBuffer);
      setPreviewFileMetadata(fileToPreview);
      setIsPreviewing(true); // This will be used to trigger the dialog open state
    } catch (error) {
      console.error("Error preparing file preview:", error);
      toast({
        title: "Preview Error",
        description: `Could not load file for preview. ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        variant: "destructive",
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
      const newFolder = await foldersApi.createFolder(
        token,
        name,
        currentFolder?._id || null
      );
      setFolders((prev) => [...prev, newFolder]);
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

  const handleUploadFiles = async (filesList: FileList) => {
    const files = Array.from(filesList);
    if (!token) {
      // Check for token first
      toast({
        title: "Upload Error",
        description: "Cannot upload files: Not authenticated.",
        variant: "destructive",
      });
      setIsUploading(false);
      return;
    }

    const cryptoKey = await getMasterCryptoKey();
    if (!cryptoKey) {
      toast({
        title: "Upload Error",
        description:
          "Encryption key is not available. You might need to log in again or ensure your session is active.",
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

        // New: Determine originalMimeType using the helper function
        const originalMimeType = getAccurateMimeType(file);
        // console.log(`File: ${file.name}, Browser MIME: ${file.type}, Accurate MIME: ${originalMimeType}`); // For debugging

        // Read file to ArrayBuffer
        const fileReader = new FileReader();
        const fileBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
          fileReader.onload = () => resolve(fileReader.result as ArrayBuffer);
          fileReader.onerror = () => reject(fileReader.error);
          fileReader.readAsArrayBuffer(file);
        });

        // Encrypt the file buffer
        const { iv, ciphertext } = await encryptFile(fileBuffer, cryptoKey); // Use cryptoKey

        // Create the combined Blob
        const encryptedBlob = new Blob([iv, ciphertext]);

        // Call the updated filesApi.uploadFile
        await filesApi.uploadFile(
          token,
          encryptedBlob,
          file.name,
          originalMimeType,
          currentFolder?._id || null
        );

        completedFiles++;
        setUploadProgress(Math.round((completedFiles / totalFiles) * 100));
      }

      loadFilesAndFolders();

      toast({
        title: "Success",
        description: `${totalFiles} ${
          totalFiles === 1 ? "file" : "files"
        } uploaded successfully`,
      });
    } catch (error) {
      console.error("Error uploading files:", error);

      // Check if it's an ApiError and has status 413
      if (
        typeof error === "object" &&
        error !== null &&
        "status" in error &&
        (error as any).status === 413
      ) {
        const apiError = error as {
          message: string;
          status: number;
          storageUsed?: number;
          storageLimit?: number;
          fileName?: string;
        };
        toast({
          title: "Upload Failed: Insufficient Storage",
          description:
            apiError.message ||
            `Not enough space to upload. Please manage your storage.`,
          variant: "destructive",
          action: (
            <ToastAction
              altText="Upgrade"
              onClick={() => setIsUpgradeStorageDialogOpen(true)}
            >
              Upgrade Storage
            </ToastAction>
          ),
        });
      } else if (
        typeof error === "object" &&
        error !== null &&
        "message" in error
      ) {
        // Handle other ApiErrors
        toast({
          title: "Error Uploading Files",
          description: (error as { message: string }).message,
          variant: "destructive",
        });
      } else {
        // Handle generic errors
        toast({
          title: "Error Uploading Files",
          description: "An unexpected error occurred during upload.",
          variant: "destructive",
        });
      }
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteFile = async (fileId: string) => {
    if (!token) return;

    try {
      await filesApi.deleteFile(token, fileId);
      setFiles((prev) => prev.filter((file) => file._id !== fileId));
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
      setFolders((prev) => prev.filter((folder) => folder._id !== folderId));
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
    setSearchQuery(""); // Clear search when navigating to a folder
  };

  const handleNavigateUp = async () => {
    setSearchQuery(""); // Clear search when navigating up
    if (!currentFolder || !currentFolder.parentId || !token) {
      setCurrentFolder(null);
      // setSearchQuery(''); // Already cleared at the top of function
      return;
    }

    try {
      const parentFolders = await foldersApi.getFolders(token);
      const parentFolder = parentFolders.find(
        (f) => f._id === currentFolder.parentId
      );
      setCurrentFolder(parentFolder || null);
      // setSearchQuery(''); // Already cleared
    } catch (error) {
      console.error("Error navigating up:", error);
      setCurrentFolder(null);
      // setSearchQuery(''); // Already cleared
    }
  };

  const handleFileStarToggled = (fileId: string, newIsStarred: boolean) => {
    setFiles((prevFiles) =>
      prevFiles.map((f) =>
        f._id === fileId ? { ...f, isStarred: newIsStarred } : f
      )
    );
    // Note: This updates the local state for the main file list.
    // If the user is currently viewing a "Starred Files" list (to be implemented),
    // that list might also need a separate update or refetch.
    // For now, this handles the main `files` array.
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">
          {searchQuery
            ? `Search results for "${searchQuery}"`
            : currentFolder
            ? currentFolder.name
            : "My Drive"}
        </h2>
      </div>

      <FilesToolbar
        currentFolder={currentFolder}
        onNavigateUp={handleNavigateUp}
        onCreateFolder={handleCreateFolder}
        onUploadFiles={handleUploadFiles}
        isUploading={isUploading}
        uploadProgress={uploadProgress}
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        onSearchSubmit={loadFilesAndFolders}
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
          onStarToggle={handleFileStarToggled} // Add this prop
        />
      )}

      {isPreviewLoading && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100]">
          {" "}
          {/* Ensure high z-index */}
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

      <UpgradeStorageDialog
        isOpen={isUpgradeStorageDialogOpen}
        onOpenChange={setIsUpgradeStorageDialogOpen}
      />
    </div>
  );
};

export default Dashboard;

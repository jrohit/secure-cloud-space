import OrganizeItemDialog from "@/components/dialogs/OrganizeItemDialog"; // Added for Organize
import RenameItemDialog from "@/components/dialogs/RenameItemDialog"; // Added for Rename
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
import { generateImageThumbnail } from "@/lib/imageUtils"; // Adjust path if needed
import { filesApi, foldersApi } from "@/services/api";
import { File, Folder } from "@/types";
import { useEffect, useState } from "react";

// Cache for decrypted file previews
const decryptedFileCache = new Map<string, ArrayBuffer>();

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
    heic: "image/heic",
    heif: "image/heif",
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

// Simple formatBytes helper (can be placed outside component or in a utils file)
function formatBytes(bytes: number, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

const Dashboard = () => {
  const { user, token, getMasterCryptoKey, refreshUserStorageInfo } = useAuth(); // Added refreshUserStorageInfo
  const { toast } = useToast();
  const [files, setFiles] = useState<File[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalFiles, setTotalFiles] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
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
  const [currentPreviewIndex, setCurrentPreviewIndex] = useState<number | null>(
    null
  );
  const [folderHistory, setFolderHistory] = useState<Folder[]>([]);
  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false); // Added for Rename
  const [renameItemInfo, setRenameItemInfo] = useState<{
    id: string;
    type: 'file' | 'folder';
    currentName: string;
  } | null>(null); // Added for Rename
  const [isOrganizeDialogOpen, setIsOrganizeDialogOpen] = useState(false); // Added for Organize
  const [organizeItemInfo, setOrganizeItemInfo] = useState<{
    id: string;
    type: 'file' | 'folder';
    itemName: string;
    currentParentId: string | null;
  } | null>(null); // Added for Organize
  const [availableFoldersForMove, setAvailableFoldersForMove] = useState<Folder[]>([]); // Added for Organize
  const [viewMode, setViewMode] = useState<'card' | 'list'>('card'); // Added for View Toggle
  const [thumbnailCache, setThumbnailCache] = useState<Map<string, string>>(new Map());


  useEffect(() => {
    if (token) {
      // When currentFolder or searchQuery changes, reset pagination and load first page
      setFiles([]); // Clear existing files
      setFolders([]); // Clear existing folders, or handle folder pagination separately if needed
      setCurrentPage(1); // Reset to page 1
      setTotalFiles(0);
      setTotalPages(0);
      loadFilesAndFolders(true); // Pass true to indicate it's a fresh load
    }
  }, [token, currentFolder, searchQuery]);

  // Separate useEffect for loading more data when currentPage changes (for "Load More" style)
  // This effect should NOT run on initial load if the above effect already handles it.
  // It's more for when `currentPage` is incremented by a "Load More" button.
  useEffect(() => {
    if (token && currentPage > 1 && !isLoadingMore) { // Only load if not already loading more for this page
      // This condition `!isLoadingMore` might be redundant if `isLoadingMore` is managed correctly
      // around the call to `loadFilesAndFolders`.
      // loadFilesAndFolders(false); // false indicates appending data, not a fresh load
    }
  }, [token, currentPage]); // Removed isLoadingMore from dependencies to avoid potential loops if not managed carefully

  const updateThumbnailCache = (fileId: string, thumbnailUrl: string) => {
    setThumbnailCache(prevCache => new Map(prevCache).set(fileId, thumbnailUrl));
  };

  const requestDecryptedFileForThumbnail = async (
    fileId: string,
    callback: (args: { fileId: string; buffer?: ArrayBuffer; error?: string }) => void
  ) => {
    if (!token) {
      callback({ fileId, error: "Not authenticated." });
      return;
    }
    // Check cache for decrypted file first (e.g., decryptedFileCache from preview logic if applicable)
    // For simplicity, we'll re-fetch and decrypt here. A more robust solution would share decryption results.
    // const cachedDecrypted = decryptedFileCache.get(fileId + '_' + /* updatedAt property */);
    // if (cachedDecrypted) {
    //   callback({ fileId, buffer: cachedDecrypted.slice(0) });
    //   return;
    // }

    console.log(`[Dashboard] Attempting to download file for thumbnail. File ID: ${fileId}`); // Add this line

    try {
      const encryptedBlob = await filesApi.downloadFile(token, fileId);
      const encryptedBuffer = await encryptedBlob.arrayBuffer();

      if (encryptedBuffer.byteLength < 12) { // Basic check for IV
        callback({ fileId, error: "Downloaded file data is too short." });
        return;
      }

      const cryptoKey = await getMasterCryptoKey();
      if (!cryptoKey) {
        callback({ fileId, error: "Decryption key not available." });
        return;
      }

      const decryptedBuffer = await decryptFile(encryptedBuffer, cryptoKey);
      // Transfer ownership of the buffer by slicing if it's to be used elsewhere,
      // or ensure it's correctly handled by the worker.
      callback({ fileId, buffer: decryptedBuffer.slice(0) });
      // Potentially cache this decryptedBuffer if it might be reused soon (e.g., for preview)
      // decryptedFileCache.set(fileId + '_' + /* updatedAt */, decryptedBuffer.slice(0));

    } catch (error) {
      console.error(`Error preparing file ${fileId} for thumbnail:`, error);
      let errorMessage = "Unknown error during decryption/download.";
      if (typeof error === 'object' && error !== null && 'message' in error) {
        errorMessage = (error as { message: string }).message;
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      callback({ fileId, error: errorMessage });
    }
  };


  const loadFilesAndFolders = async (isFreshLoad = false) => {
    if (isFreshLoad) {
      setLoading(true); // Full page loading indicator
      setFiles([]); // Clear files for a fresh load
      setFolders([]); // Clear folders for a fresh load
    } else {
      setIsLoadingMore(true); // Specific indicator for loading more
    }

    try {
      if (token) {
        const limit = 50; // Or your desired page size
        // Pass searchQuery only to getFiles, and currentPage & limit
        const filesResponse = await filesApi.getFiles(
          token,
          currentFolder?._id || null,
          searchQuery,
          isFreshLoad ? 1 : currentPage, // Use 1 if fresh, else current page
          limit
        );

        // Only fetch folders if it's a fresh load or if folders also need pagination (not implemented here)
        // For simplicity, folders are reloaded with files on fresh load.
        // If folders were paginated, their logic would be similar.
        let foldersData: Folder[] = [];
        if (isFreshLoad) {
          foldersData = await foldersApi.getFolders(token, currentFolder?._id || null);
          setFolders(foldersData);
        }

        setFiles(prevFiles => {
          if (isFreshLoad) {
            return filesResponse.files;
          } else {
            const existingFileIds = new Set(prevFiles.map(file => file._id));
            const newUniqueFiles = filesResponse.files.filter(file => !existingFileIds.has(file._id));
            return [...prevFiles, ...newUniqueFiles];
          }
        });
        setTotalFiles(filesResponse.totalFiles);
        setTotalPages(filesResponse.totalPages);
        if (isFreshLoad) setCurrentPage(filesResponse.currentPage); // Set current page from response on fresh load
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
      setIsLoadingMore(false);
    }
  };

  const handleLoadMore = () => {
    if (currentPage < totalPages && !isLoadingMore) {
      setCurrentPage(prevPage => prevPage + 1);
      // The useEffect listening to currentPage will trigger loadFilesAndFolders
      // Or, call it directly:
      loadFilesAndFolders(false); // false indicates it's not a fresh load
    }
  };

  const handleBreadcrumbNavigate = (indexInHistory: number) => {
    setSearchQuery(""); // Clear search query

    if (indexInHistory === -1) { // Clicked on "My Drive" or root
      setCurrentFolder(null);
      setFolderHistory([]);
    } else if (indexInHistory >= 0 && indexInHistory < folderHistory.length) {
      // Clicked on a folder in the history
      const targetFolder = folderHistory[indexInHistory];
      setCurrentFolder(targetFolder);
      // Trim the history to the point of the clicked folder
      setFolderHistory(prevHistory => prevHistory.slice(0, indexInHistory + 1));
    } else {
      console.warn("Invalid index received from breadcrumb navigation:", indexInHistory);
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

    // Cache Key
    const cacheKey = fileToPreview._id + '_' + new Date(fileToPreview.updatedAt).getTime();

    // Cache Check
    if (decryptedFileCache.has(cacheKey)) {
      const cachedBuffer = decryptedFileCache.get(cacheKey);
      if (cachedBuffer) {
        setPreviewFileContent(cachedBuffer.slice(0)); // Use a slice for safety
        setPreviewFileMetadata(fileToPreview);
        const fileIndex = files.findIndex((f) => f._id === fileToPreview._id);
        if (fileIndex !== -1) {
          setCurrentPreviewIndex(fileIndex);
        } else {
          setCurrentPreviewIndex(null);
          console.warn("Previewed file (from cache) not found in current files list for navigation indexing.");
        }
        setIsPreviewing(true);
        setIsPreviewLoading(false); // Ensure loading is false
        // Dismiss any "loading" toasts if they were shown by a previous non-cached attempt.
        // This might require a toast instance ID if you want to target a specific toast.
        // For now, we assume subsequent toasts will overwrite or the user can dismiss.
        console.log(`[Dashboard] Cache hit for preview: ${fileToPreview.name}`);
        return;
      }
    }
    console.log(`[Dashboard] Cache miss for preview: ${fileToPreview.name}. Fetching and decrypting.`);

    try {
      setIsPreviewLoading(true);
      // It's important to only show the toast if we are actually going to fetch.
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
      const stableDecryptedBuffer = decryptedBuffer.slice(0);

      // Store in cache
      decryptedFileCache.set(cacheKey, stableDecryptedBuffer);
      console.log(`[Dashboard] Stored in cache: ${fileToPreview.name}`);

      console.log(
        "[Dashboard] After decryptFile - decryptedBuffer.byteLength:",
        decryptedBuffer.byteLength
      );
      try {
        const sliceTestDashboard = decryptedBuffer.slice(0);
        console.log(
          "[Dashboard] After decryptFile - decryptedBuffer slice test successful, new buffer byteLength:",
          sliceTestDashboard.byteLength
        );
        // You could also check if they are the same buffer instance, though slice creates a new one.
        // console.log('[Dashboard] Buffers are same instance after slice:', decryptedBuffer === sliceTestDashboard); // Should be false
      } catch (e) {
        console.error(
          "[Dashboard] Error trying to slice decryptedBuffer immediately after decryptFile:",
          e
        );
        // If this error occurs, the buffer is likely already detached or invalid from decryptFile.
      }

      setPreviewFileContent(stableDecryptedBuffer);
      setPreviewFileMetadata(fileToPreview);
      const fileIndex = files.findIndex((f) => f._id === fileToPreview._id);
      if (fileIndex !== -1) {
        setCurrentPreviewIndex(fileIndex);
      } else {
        // This case should ideally not happen if previewing from the current 'files' list.
        // Consider how to handle if it does, e.g., log an error or disable navigation.
        setCurrentPreviewIndex(null);
        console.warn(
          "Previewed file not found in current files list for navigation indexing."
        );
      }
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
    const filesArray = Array.from(filesList); // Changed variable name for clarity
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

    // Calculate total upload size
    const totalUploadSize = filesArray.reduce((acc, file) => acc + file.size, 0);

    // Perform client-side quota check
    if (user && typeof user.storageLimit === 'number' && typeof user.storageUsed === 'number') {
      if (user.storageUsed + totalUploadSize > user.storageLimit) {
        toast({
          title: "Insufficient Storage",
          description: `You do not have enough space to upload these files. Required: ${formatBytes(totalUploadSize)}, Available: ${formatBytes(user.storageLimit - user.storageUsed)}. Please upgrade your plan or free up space.`,
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
        setIsUploading(false); // Ensure any uploading state is reset
        return; // Stop the upload process
      }
    } else {
      console.warn("User storage information not available for client-side quota check. Proceeding with upload.");
    }

    setIsUploading(true);
    setUploadProgress(0);

    const totalFiles = filesArray.length; // Use filesArray
    let completedFiles = 0;

    try {
      for (let i = 0; i < filesArray.length; i++) { // Use filesArray
        const file = filesArray[i]; // Use filesArray

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
          // thumbnailBlob argument is now omitted
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

      if (completedFiles === totalFiles && totalFiles > 0) {
        if (refreshUserStorageInfo) {
          await refreshUserStorageInfo();
        }
      }
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
      await filesApi.trashFile(token, fileId); // Updated to use trashFile
      setFiles((prev) => prev.filter((file) => file._id !== fileId));
      toast({
        title: "Success",
        description: "File moved to trash", // Updated message
      });
    } catch (error) {
      console.error("Error moving file to trash:", error); // Updated message
      toast({
        title: "Error",
        description: "Failed to move file to trash", // Updated message
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
        description: "Folder and its contents moved to trash", // MODIFIED
      });
    } catch (error) {
      console.error("Error moving folder to trash:", error); // MODIFIED
      toast({
        title: "Error",
        description: "Failed to move folder to trash", // MODIFIED
        variant: "destructive",
      });
    }
  };

  const handleNavigateToFolder = (folder: Folder) => {
    setCurrentFolder(folder);
    setFolderHistory(prev => [...prev, folder]); // Add current folder to history
    setSearchQuery("");
  };

  const handleNavigateUp = () => {
    setSearchQuery("");
    if (folderHistory.length === 0) { // Should not happen if currentFolder is set, but as a safeguard
      setCurrentFolder(null);
      // folderHistory is already empty
      return;
    }

    const newHistory = folderHistory.slice(0, -1); // Remove current folder from history
    setFolderHistory(newHistory);

    if (newHistory.length === 0) { // Navigated up to root
      setCurrentFolder(null);
    } else {
      setCurrentFolder(newHistory[newHistory.length - 1]); // Set current folder to the new last item in history (the parent)
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

  // Placeholder for Rename
  const handleRenameItem = (id: string, type: 'file' | 'folder', currentName: string) => {
    setRenameItemInfo({ id, type, currentName });
    setIsRenameDialogOpen(true);
  };

  const handleRenameSubmit = async (newName: string) => {
    if (!renameItemInfo || !token) return;

    const { id, type } = renameItemInfo;

    try {
      if (type === 'file') {
        const updatedFile = await filesApi.renameFile(token, id, newName);
        setFiles((prevFiles) =>
          prevFiles.map((f) => (f._id === id ? { ...f, ...updatedFile } : f))
        );
        toast({
          title: "Success",
          description: `File "${renameItemInfo.currentName}" renamed to "${newName}".`,
        });
      } else if (type === 'folder') {
        const updatedFolder = await foldersApi.renameFolder(token, id, newName);
        setFolders((prevFolders) =>
          prevFolders.map((f) => (f._id === id ? { ...f, ...updatedFolder } : f))
        );
        toast({
          title: "Success",
          description: `Folder "${renameItemInfo.currentName}" renamed to "${newName}".`,
        });
      }
      setIsRenameDialogOpen(false);
      setRenameItemInfo(null);
    } catch (error) {
      console.error(`Error renaming ${type}:`, error);
      toast({
        title: "Error",
        description: `Failed to rename ${type}. ${error instanceof Error ? error.message : ''}`,
        variant: "destructive",
      });
      // Optionally, keep the dialog open on error or close it
      // setIsRenameDialogOpen(false);
      // setRenameItemInfo(null);
    }
  };

  // Placeholder for Organize
  const handleOrganizeItem = (id: string, type: 'file' | 'folder', currentParentId: string | null) => {
    const itemToOrganize = type === 'file'
      ? files.find(f => f._id === id)
      : folders.find(f => f._id === id);

    if (!itemToOrganize) {
      toast({ title: "Error", description: "Item not found.", variant: "destructive" });
      return;
    }

    setOrganizeItemInfo({ id, type, itemName: itemToOrganize.name, currentParentId });

    // Prepare available folders for moving:
    // Exclude the current folder itself if item is a folder
    // Exclude current parent of the item (handled by dialog UI not showing current parent as an option implicitly if desired)
    let filteredFolders = [...folders]; // Operate on a copy
    if (type === 'folder') {
      filteredFolders = filteredFolders.filter(f => f._id !== id);
      // TODO: Advanced - filter out children of this folder as well
    }
    setAvailableFoldersForMove(filteredFolders);
    setIsOrganizeDialogOpen(true);
  };

  const handleOrganizeSubmit = async (newParentId: string | null) => {
    if (!organizeItemInfo || !token) return;

    const { id, type, itemName } = organizeItemInfo;

    try {
      if (type === 'file') {
        await filesApi.moveFile(token, id, newParentId);
      } else { // type === 'folder'
        await foldersApi.moveFolder(token, id, newParentId);
      }

      toast({
        title: "Success",
        description: `"${itemName}" moved successfully.`,
      });

      // Refresh the current view
      await loadFilesAndFolders();

      // If moving to a *different* folder than current, the item will disappear.
      // If moving *within* the current folder (e.g. from root to a subfolder, while viewing root), it also needs refresh.
      // If moving to root, and currently viewing a folder, it will disappear.

    } catch (error) {
      console.error(`Error moving ${type}:`, error);
      toast({
        title: "Error",
        description: `Failed to move ${type}. ${error instanceof Error ? error.message : ''}`,
        variant: "destructive",
      });
    } finally {
      setIsOrganizeDialogOpen(false);
      setOrganizeItemInfo(null);
    }
  };

  const handleNavigateNext = async () => {
    if (
      currentPreviewIndex !== null &&
      currentPreviewIndex < files.length - 1
    ) {
      const nextIndex = currentPreviewIndex + 1;
      const nextFileToPreview = files[nextIndex];
      // Re-use the core logic of handleFilePreview.
      // This assumes handleFilePreview can be called directly.
      // If handleFilePreview has side effects like showing initial toasts that are undesirable on navigate,
      // then its core (fetching, decrypting, setting state) needs to be refactored into a helper.
      // For now, let's assume direct call is okay for a first pass.
      await handleFilePreview(nextFileToPreview);
      // setCurrentPreviewIndex will be updated by the handleFilePreview call.
    }
  };

  const handleNavigatePrevious = async () => {
    if (currentPreviewIndex !== null && currentPreviewIndex > 0) {
      const prevIndex = currentPreviewIndex - 1;
      const prevFileToPreview = files[prevIndex];
      await handleFilePreview(prevFileToPreview);
      // setCurrentPreviewIndex will be updated by the handleFilePreview call.
    }
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
        folderHistory={folderHistory}
        onBreadcrumbNavigate={handleBreadcrumbNavigate} // Pass the handler
        viewMode={viewMode} // Pass viewMode
        onViewModeChange={setViewMode} // Pass handler
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
          onStarToggle={handleFileStarToggled}
          onRenameItem={handleRenameItem}
          onOrganizeItem={handleOrganizeItem}
          currentParentId={currentFolder?._id || null} // Pass currentParentId
          viewMode={viewMode} // Pass viewMode
          // Props for thumbnail generation
          thumbnailCache={thumbnailCache}
          requestDecryptedFileForThumbnail={requestDecryptedFileForThumbnail}
          onThumbnailGenerated={updateThumbnailCache}
        />
      )}

      {!loading && !isLoadingMore && files.length > 0 && currentPage < totalPages && (
        <div className="flex justify-center mt-8">
          <button
            onClick={handleLoadMore}
            disabled={isLoadingMore || currentPage >= totalPages}
            className="px-6 py-3 bg-primary text-primary-foreground rounded-lg shadow hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {isLoadingMore ? <Spinner className="h-5 w-5 mr-2 inline" /> : null}
            Load More
          </button>
        </div>
      )}
      {isLoadingMore && (
         <div className="flex justify-center py-6">
           <Spinner className="h-8 w-8" />
         </div>
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
            setCurrentPreviewIndex(null); // Reset preview index
          }}
          fileContent={previewFileContent}
          fileName={previewFileMetadata.name}
          fileType={previewFileMetadata.type}
          onNext={handleNavigateNext}
          onPrevious={handleNavigatePrevious}
          canNavigateNext={
            currentPreviewIndex !== null &&
            currentPreviewIndex < files.length - 1
          }
          canNavigatePrevious={
            currentPreviewIndex !== null && currentPreviewIndex > 0
          }
        />
      )}

      <UpgradeStorageDialog
        isOpen={isUpgradeStorageDialogOpen}
        onOpenChange={setIsUpgradeStorageDialogOpen}
      />

      {renameItemInfo && (
        <RenameItemDialog
          isOpen={isRenameDialogOpen}
          onOpenChange={(isOpen) => {
            setIsRenameDialogOpen(isOpen);
            if (!isOpen) {
              setRenameItemInfo(null); // Reset info when dialog is closed
            }
          }}
          itemType={renameItemInfo.type}
          itemId={renameItemInfo.id}
          currentName={renameItemInfo.currentName}
          onRenameSubmit={handleRenameSubmit}
        />
      )}

      {organizeItemInfo && (
        <OrganizeItemDialog
          isOpen={isOrganizeDialogOpen}
          onOpenChange={(isOpen) => {
            setIsOrganizeDialogOpen(isOpen);
            if (!isOpen) {
              setOrganizeItemInfo(null);
            }
          }}
          itemType={organizeItemInfo.type}
          itemName={organizeItemInfo.itemName}
          availableFolders={availableFoldersForMove}
          onOrganizeSubmit={handleOrganizeSubmit}
        />
      )}
    </div>
  );
};

export default Dashboard;

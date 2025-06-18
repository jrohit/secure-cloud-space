import OrganizeItemDialog from "@/components/dialogs/OrganizeItemDialog"; // Added for Organize
import RenameItemDialog from "@/components/dialogs/RenameItemDialog"; // Added for Rename
import UpgradeStorageDialog from "@/components/dialogs/UpgradeStorageDialog"; // Added
import FileGrid from "@/components/files/FileGrid";
import FilesEmptyState from "@/components/files/FilesEmptyState";
import FilesToolbar from "@/components/files/FilesToolbar";
import FilePreviewDialog from "@/components/previews/FilePreviewDialog";
import { Spinner } from "@/components/ui/Spinner";
import { Progress } from "@/components/ui/progress"; // Added for folder upload progress
import { ToastAction } from "@/components/ui/toast"; // Added
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { decryptFile, encryptFile } from "@/lib/cryptoUtils";
import { filesApi, foldersApi } from "@/services/api";
import { MyFileType as File, Folder } from "@/types";
// Removed useRef as toolbarRef is no longer needed for JS sticky
import throttle from "lodash/throttle";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDataRefresh } from "@/contexts/DataRefreshContext"; // Import useDataRefresh

// Cache for decrypted file previews
const decryptedFileCache = new Map<string, ArrayBuffer>();
// Cache for folder IDs: 'parentId_or_root/folderName' -> folderId
const folderCache = new Map<string, string>();

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

const getMimeTypeExtension = (mimeType: string): string | null => {
  const defaultExtensions: { [key: string]: string } = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/gif": ".gif",
    "application/pdf": ".pdf",
    "text/plain": ".txt",
    "text/markdown": ".md",
    "application/msword": ".doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      ".docx",
    "application/vnd.ms-excel": ".xls",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
      ".xlsx",
    "application/vnd.ms-powerpoint": ".ppt",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation":
      ".pptx",
    "video/mp4": ".mp4",
    "video/webm": ".webm",
    "audio/mpeg": ".mp3",
    "audio/ogg": ".ogg",
    "application/zip": ".zip",
    // Add more as needed
  };
  return defaultExtensions[mimeType.toLowerCase()] || null;
};

// Simple formatBytes helper (can be placed outside component or in a utils file)
function formatBytes(bytes: number, decimals = 2) {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}

interface ProcessedFile {
  file: globalThis.File; // Use globalThis.File to avoid conflict with local File type
  relativePath: string;
}

const Dashboard = () => {
  const scrollPositionRef = useRef<number | null>(null); // Added for scroll restoration
  const scrollableContainerRef = useRef<HTMLDivElement | null>(null); // Ref for the scrollable container
  const { user, token, getMasterCryptoKey, refreshUserStorageInfo } = useAuth(); // Added refreshUserStorageInfo
  const { registerDataRefreshFunction } = useDataRefresh(); // Use the context hook
  const { toast } = useToast();
  const [files, setFiles] = useState<File[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentFolder, setCurrentFolder] = useState<Folder | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);
  const [totalFilesCount, setTotalFilesCount] = useState(0);
  const [totalFilePages, setTotalFilePages] = useState(0);
  const [isLoadingMore, setIsLoadingMore] = useState(false); // For infinite scroll
  const [hasMoreFiles, setHasMoreFiles] = useState(true); // For infinite scroll
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
    type: "file" | "folder";
    currentName: string;
  } | null>(null); // Added for Rename
  const [isOrganizeDialogOpen, setIsOrganizeDialogOpen] = useState(false); // Added for Organize
  const [organizeItemInfo, setOrganizeItemInfo] = useState<{
    id: string;
    type: "file" | "folder";
    itemName: string;
    currentParentId: string | null;
  } | null>(null); // Added for Organize
  const [availableFoldersForMove, setAvailableFoldersForMove] = useState<
    Folder[]
  >([]); // Added for Organize
  const [viewMode, setViewMode] = useState<"card" | "list">("card"); // Added for View Toggle
  // Removed isToolbarSticky, toolbarHeight, toolbarRef, STICKY_THRESHOLD as CSS sticky will be used

  // State for folder upload queue and progress
  const [folderUploadQueue, setFolderUploadQueue] = useState<ProcessedFile[]>(
    []
  );
  const [isUploadingFolder, setIsUploadingFolder] = useState<boolean>(false);
  const [currentUploadingFolderFile, setCurrentUploadingFolderFile] = useState<
    string | null
  >(null);
  const [processedFolderFilesCount, setProcessedFolderFilesCount] =
    useState<number>(0);
  const [totalFilesToUploadInFolder, setTotalFilesToUploadInFolder] =
    useState<number>(0);
  const isProcessingFolderQueue = useRef<boolean>(false);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set()); // Added for selection
  const [deleteOpId, setDeleteOpId] = useState<number | null>(null); // Added for delete operation tracking

  // Effect for initial load and when context changes (folder, search)
  useEffect(() => {
    if (token) {
      setFiles([]); // Clear existing files
      setCurrentPage(1); // Reset to page 1
      setHasMoreFiles(true); // Assume there are more files initially
      // loadFilesAndFolders will be called by the effect below due to currentPage change to 1
    }
  }, [token, currentFolder, searchQuery]);

  // Effect for loading files based on currentPage
  const loadFilesAndFolders = useCallback(
    async (options?: { bustCache?: boolean; pageToLoad?: number }) => {
      if (!token) return;

      const effectivePage =
        options?.pageToLoad !== undefined ? options.pageToLoad : currentPage;
      const cacheBusterValue = options?.bustCache
        ? Date.now().toString()
        : undefined;

      if (effectivePage === 1) {
        setLoading(true);
      } else {
        if (isLoadingMore || !hasMoreFiles) return;
        setIsLoadingMore(true);
      }

      try {
        const filesResponse = await filesApi.getFiles(
          token,
          currentFolder?._id || null,
          searchQuery,
          effectivePage,
          itemsPerPage,
          cacheBusterValue // Pass to API
        );

        if (effectivePage === 1) {
          const foldersData = await foldersApi.getFolders(
            token,
            currentFolder?._id || null,
            cacheBusterValue // Pass to API
          );
          setFolders(foldersData);
          setFiles(filesResponse.files);
          setTotalFilesCount(filesResponse.totalCount);
          setTotalFilePages(filesResponse.totalPages);
          setHasMoreFiles(effectivePage < filesResponse.totalPages); // Use effectivePage
        } else {
          setFiles((prevFiles) => [...prevFiles, ...filesResponse.files]);
          setTotalFilePages(filesResponse.totalPages);
          setHasMoreFiles(effectivePage < filesResponse.totalPages); // Use effectivePage
        }
      } catch (error) {
        console.error("Error loading files and folders:", error);
        toast({
          title: "Error",
          description: "Failed to load your files and folders",
          variant: "destructive",
        });
        setHasMoreFiles(false);
      } finally {
        if (effectivePage === 1) {
          // Use effectivePage
          setLoading(false);
        } else {
          setIsLoadingMore(false);
        }
      }
    },
    [
      token,
      currentFolder,
      searchQuery,
      currentPage,
      itemsPerPage,
      toast,
      isLoadingMore,
      hasMoreFiles,
      setLoading,
      setIsLoadingMore,
      setHasMoreFiles,
      setFiles,
      setFolders,
      setTotalFilesCount,
      setTotalFilePages,
    ]
  );

  useEffect(() => {
    if (token) {
      loadFilesAndFolders({ pageToLoad: currentPage });
    }
  }, [token, currentPage, currentFolder, searchQuery]);

  const handleDownloadFile = async (
    fileId: string,
    fileName: string,
    originalFileType: string
  ) => {
    if (!token) {
      toast({
        title: "Error",
        description: "Not authenticated.",
        variant: "destructive",
      });
      return;
    }

    const downloadToastId = toast({
      title: "Preparing Download",
      description: `Downloading ${fileName}...`,
    });

    try {
      const encryptedBlob = await filesApi.downloadFile(token, fileId);
      const encryptedBuffer = await encryptedBlob.arrayBuffer();

      const cryptoKey = await getMasterCryptoKey();
      if (!cryptoKey) {
        toast({
          title: "Download Error",
          description: "Could not retrieve decryption key.",
          variant: "destructive",
          duration: 5000,
        });
        return;
      }

      const decryptedBuffer = await decryptFile(encryptedBuffer, cryptoKey);
      const fileContentBuffer = decryptedBuffer.slice(0);

      const decryptedBlob = new Blob([fileContentBuffer], {
        type: originalFileType,
      });

      let finalFileName = fileName;
      const nameParts = fileName.split(".");
      const currentExtension =
        nameParts.length > 1 ? `.${nameParts.pop()?.toLowerCase()}` : null;
      let expectedExtension = getMimeTypeExtension(originalFileType);

      if (
        expectedExtension &&
        (!currentExtension || currentExtension !== expectedExtension)
      ) {
        if (!currentExtension) {
          finalFileName = `${fileName}${expectedExtension}`;
        }
      }

      const url = URL.createObjectURL(decryptedBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = finalFileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "Download Started",
        description: `${fileName} should begin downloading shortly.`,
        variant: "default",
        duration: 5000,
      });
    } catch (error: any) {
      console.error("Error downloading or decrypting file:", error);
      toast({
        title: "Download Error",
        description: `Failed to download ${fileName}. ${
          error.message || "Unknown error"
        }`,
        variant: "destructive",
        duration: 5000,
      });
    }
  };

  const handleScroll = useCallback(() => {
    // Threshold from bottom to trigger load, e.g., 200px
    const threshold = 200;
    // Check if user is near the bottom of the page
    if (
      window.innerHeight + document.documentElement.scrollTop >=
      document.documentElement.offsetHeight - threshold
    ) {
      if (hasMoreFiles && !isLoadingMore && !loading) {
        setCurrentPage((prevPage) => prevPage + 1);
      }
    }
  }, [hasMoreFiles, isLoadingMore, loading]); // Add `loading` to prevent fetching during initial load

  const throttledScrollHandler = useMemo(
    () => throttle(handleScroll, 300),
    [handleScroll]
  ); // For infinite scroll (remains)

  useEffect(() => {
    // For infinite scroll
    window.addEventListener("scroll", throttledScrollHandler);
    // Removed toolbar stickiness scroll handler and height measurement

    return () => {
      window.removeEventListener("scroll", throttledScrollHandler);
      throttledScrollHandler.cancel();
      // Removed toolbar stickiness scroll handler cleanup
    };
  }, [throttledScrollHandler]); // Removed throttledToolbarScrollHandler from deps

  const handleBreadcrumbNavigate = (indexInHistory: number) => {
    setSearchQuery(""); // Clear search query
    // setCurrentPage(1) and setFiles([]) will be handled by the main useEffect for context change

    if (indexInHistory === -1) {
      // Clicked on "My Drive" or root
      setCurrentFolder(null); // This will trigger the useEffect for context change
      setFolderHistory([]);
    } else if (indexInHistory >= 0 && indexInHistory < folderHistory.length) {
      // Clicked on a folder in the history
      const targetFolder = folderHistory[indexInHistory];
      setCurrentFolder(targetFolder); // This will trigger the useEffect for context change
      setFolderHistory((prevHistory) =>
        prevHistory.slice(0, indexInHistory + 1)
      );
    } else {
      console.warn(
        "Invalid index received from breadcrumb navigation:",
        indexInHistory
      );
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
    const cacheKey =
      fileToPreview._id + "_" + new Date(fileToPreview.updatedAt).getTime();

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
          console.warn(
            "Previewed file (from cache) not found in current files list for navigation indexing."
          );
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
    console.log(
      `[Dashboard] Cache miss for preview: ${fileToPreview.name}. Fetching and decrypting.`
    );

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
      // setFolders((prev) => [...prev, newFolder]); // Optimistic update removed
      toast({
        title: "Success",
        description: `Folder "${name}" created successfully`,
      });

      if (refreshUserStorageInfo) {
        await refreshUserStorageInfo();
      }
      setFiles([]);
      setFolders([]);
      setCurrentPage(1);
      loadFilesAndFolders({ bustCache: true, pageToLoad: 1 });
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
    if (isUploadingFolder) {
      toast({
        title: "Folder Upload in Progress",
        description:
          "Please wait for the folder upload to complete before uploading individual files.",
        variant: "destructive",
      });
      return;
    }
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
    const totalUploadSize = filesArray.reduce(
      (acc, file) => acc + file.size,
      0
    );

    // Perform client-side quota check
    if (
      user &&
      typeof user.storageLimit === "number" &&
      typeof user.storageUsed === "number"
    ) {
      if (user.storageUsed + totalUploadSize > user.storageLimit) {
        toast({
          title: "Insufficient Storage",
          description: `You do not have enough space to upload these files. Required: ${formatBytes(
            totalUploadSize
          )}, Available: ${formatBytes(
            user.storageLimit - user.storageUsed
          )}. Please upgrade your plan or free up space.`,
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
      console.warn(
        "User storage information not available for client-side quota check. Proceeding with upload."
      );
    }

    setIsUploading(true);
    setUploadProgress(0);

    const totalFiles = filesArray.length; // Use filesArray
    let completedFiles = 0;

    try {
      for (let i = 0; i < filesArray.length; i++) {
        // Use filesArray
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

      // loadFilesAndFolders(); // Replaced by new logic below

      // Upload logic finished

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

      // After successful file upload, call fetchFilesAndFolders (loadFilesAndFolders)
      // with cacheBuster for page 1.
      // Clear local data for better UX before new data is loaded.
      setFiles([]);
      setFolders([]);

      // If not already on page 1, set it. The useEffect for currentPage will also trigger a load,
      // but this explicit call ensures the cacheBuster is used for the load triggered by upload success.
      if (currentPage !== 1) {
        setCurrentPage(1);
      }
      // Explicitly call loadFilesAndFolders with cache busting for page 1.
      loadFilesAndFolders({ bustCache: true, pageToLoad: 1 });

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
    scrollPositionRef.current = scrollableContainerRef.current?.scrollTop ?? 0;
    setDeleteOpId(Date.now());

    const fileToDelete = files.find(f => f._id === fileId);
    if (!fileToDelete) {
      console.error("File not found for optimistic delete:", fileId);
      setDeleteOpId(null);
      return;
    }

    // Optimistic update
    setFiles(prevFiles => prevFiles.filter(f => f._id !== fileId));
    setTotalFilesCount(prevCount => {
      const newTotalCount = prevCount - 1;
      setTotalFilePages(Math.ceil(newTotalCount / itemsPerPage));
      return newTotalCount;
    });

    try {
      await filesApi.trashFile(token, fileId);
      toast({
        title: "Success",
        description: `File "${fileToDelete.name}" moved to trash.`,
      });
      if (refreshUserStorageInfo) {
        await refreshUserStorageInfo();
      }
      // Data consistency checks or refetching specific page can be added here if needed
    } catch (error) {
      console.error(`Error moving file "${fileToDelete.name}" to trash:`, error);
      toast({
        title: "Error",
        description: `Failed to move file "${fileToDelete.name}" to trash. Restoring...`,
        variant: "destructive",
      });
      // Revert optimistic update
      setFiles(prevFiles => [...prevFiles, fileToDelete].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())); // Example sort, adjust as needed
      setTotalFilesCount(prevCount => {
        const newTotalCount = prevCount + 1;
        setTotalFilePages(Math.ceil(newTotalCount / itemsPerPage));
        return newTotalCount;
      });
      setDeleteOpId(null);
    }
  };

  const handleDeleteFilePermanently = async (fileId: string) => {
    if (!token) return;
    // Note: Permanent delete is often not done optimistically due to its destructive nature,
    // but for consistency with the request, we'll implement it similarly.
    // A modal confirmation is highly recommended before this function is even called.

    scrollPositionRef.current = scrollableContainerRef.current?.scrollTop ?? 0;
    setDeleteOpId(Date.now());

    const fileToDelete = files.find(f => f._id === fileId);
    if (!fileToDelete) {
      console.error("File not found for optimistic permanent delete:", fileId);
      setDeleteOpId(null);
      return;
    }

    // Optimistic update (assuming it's from a view like "Trash" where it's already "soft-deleted")
    setFiles(prevFiles => prevFiles.filter(f => f._id !== fileId));
    // totalFilesCount might not need adjustment if this view is separate (e.g. Trash view)
    // For now, let's assume it does if it's part of the main file list count.
    // If this function is only called from a "Trash" view, totalFilesCount might not be relevant here.
    // However, refreshUserStorageInfo() will update the true count from backend.

    try {
      await filesApi.deleteFilePermanently(token, fileId);
      toast({
        title: "Success",
        description: `File "${fileToDelete.name}" permanently deleted.`,
      });
      if (refreshUserStorageInfo) {
        await refreshUserStorageInfo(); // This will fetch the correct storage usage.
      }
      // No need to manually adjust totalFilesCount here if refreshUserStorageInfo updates it,
      // or if this view doesn't rely on that specific count.
      // For now, we'll assume the file was part of the countable files and adjust.
      setTotalFilesCount(prevCount => {
        const newTotalCount = prevCount - 1;
        setTotalFilePages(Math.ceil(newTotalCount / itemsPerPage));
        return newTotalCount;
      });


    } catch (error) {
      console.error(`Error permanently deleting file "${fileToDelete.name}":`, error);
      toast({
        title: "Error",
        description: `Failed to permanently delete file "${fileToDelete.name}". Restoring...`,
        variant: "destructive",
      });
      setFiles(prevFiles => [...prevFiles, fileToDelete].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
      setDeleteOpId(null);
      // Revert totalFilesCount if it was optimistically changed for this view
      setTotalFilesCount(prevCount => {
        const newTotalCount = prevCount + 1;
        setTotalFilePages(Math.ceil(newTotalCount / itemsPerPage));
        return newTotalCount;
      });
    }
  };

  const handleDeleteFolder = async (folderId: string) => {
    if (!token) return;
    scrollPositionRef.current = scrollableContainerRef.current?.scrollTop ?? 0;
    setDeleteOpId(Date.now());

    const folderToDelete = folders.find(f => f._id === folderId);
    if (!folderToDelete) {
      console.error("Folder not found for optimistic delete:", folderId);
      setDeleteOpId(null);
      return;
    }

    // Optimistic update
    setFolders(prevFolders => prevFolders.filter(f => f._id !== folderId));
    // Note: Folders themselves don't affect totalFilesCount in the current setup.
    // If they did, or if there was a totalFoldersCount, it would be updated here.

    try {
      await foldersApi.deleteFolder(token, folderId);
      toast({
        title: "Success",
        description: `Folder "${folderToDelete.name}" and its contents moved to trash.`,
      });
      if (refreshUserStorageInfo) {
        await refreshUserStorageInfo(); // This will also update storage used by deleting folder contents.
      }
    } catch (error) {
      console.error(`Error moving folder "${folderToDelete.name}" to trash:`, error);
      toast({
        title: "Error",
        description: `Failed to move folder "${folderToDelete.name}" to trash. Restoring...`,
        variant: "destructive",
      });
      // Revert optimistic update
      setFolders(prevFolders => [...prevFolders, folderToDelete].sort((a,b) => a.name.localeCompare(b.name))); // Example sort
      setDeleteOpId(null);
    }
  };

  const handleNavigateToFolder = (folder: Folder) => {
    // setCurrentPage(1) and setFiles([]) handled by useEffect for context change
    setCurrentFolder(folder); // This will trigger the useEffect for context change
    setFolderHistory((prev) => [...prev, folder]);
    setSearchQuery("");
  };

  const handleNavigateUp = () => {
    // setCurrentPage(1) and setFiles([]) handled by useEffect for context change
    setSearchQuery("");
    if (folderHistory.length === 0) {
      setCurrentFolder(null); // This will trigger the useEffect for context change
      return;
    }

    const newHistory = folderHistory.slice(0, -1);
    setFolderHistory(newHistory);

    if (newHistory.length === 0) {
      setCurrentFolder(null); // This will trigger the useEffect for context change
    } else {
      setCurrentFolder(newHistory[newHistory.length - 1]); // This will trigger the useEffect for context change
    }
  };

  const handleFileStarToggled = (fileId: string, newIsStarred: boolean) => {
    // setFiles((prevFiles) => ... ); // Optimistic update removed

    // For starring, a full refresh might be too much.
    // However, to ensure consistency as per the task, applying full refresh.
    // This can be revisited for optimization.
    // Consider if toggleStarFile API returns the updated file object to avoid a full refresh.
    // For now, assuming the API call itself is the source of truth and refresh is needed.

    // The API call for toggleStarFile is missing here, it should be called before this refresh.
    // Assuming it's called and then this refresh logic follows:
    // await filesApi.toggleStarFile(token, fileId, newIsStarred); // Example API call

    setFiles([]);
    setFolders([]);
    setCurrentPage(1);
    loadFilesAndFolders({ bustCache: true, pageToLoad: 1 });

    // Note: This updates the local state for the main file list.
    // If the user is currently viewing a "Starred Files" list (to be implemented),
    // that list might also need a separate update or refetch.
    // For now, this handles the main `files` array.
  };

  // Placeholder for Rename
  const handleRenameItem = (
    id: string,
    type: "file" | "folder",
    currentName: string
  ) => {
    setRenameItemInfo({ id, type, currentName });
    setIsRenameDialogOpen(true);
  };

  const handleRenameSubmit = async (newName: string) => {
    if (!renameItemInfo || !token) return;

    const { id, type } = renameItemInfo;

    try {
      if (type === "file") {
        const updatedFile = await filesApi.renameFile(token, id, newName);
        // setFiles((prevFiles) => ...); // Optimistic update removed
        toast({
          title: "Success",
          description: `File "${renameItemInfo.currentName}" renamed to "${newName}".`,
        });
      } else if (type === "folder") {
        // const updatedFolder = await foldersApi.renameFolder(token, id, newName); // API call
        // setFolders((prevFolders) => ...); // Optimistic update removed
        toast({
          title: "Success",
          description: `Folder "${renameItemInfo.currentName}" renamed to "${newName}".`,
        });
      }
      setIsRenameDialogOpen(false);
      setRenameItemInfo(null);

      if (refreshUserStorageInfo) {
        await refreshUserStorageInfo();
      } // If rename affects storage/metadata shown
      setFiles([]);
      setFolders([]);
      setCurrentPage(1);
      loadFilesAndFolders({ bustCache: true, pageToLoad: 1 });
    } catch (error) {
      console.error(`Error renaming ${type}:`, error);
      toast({
        title: "Error",
        description: `Failed to rename ${type}. ${
          error instanceof Error ? error.message : ""
        }`,
        variant: "destructive",
      });
      // Optionally, keep the dialog open on error or close it
      // setIsRenameDialogOpen(false);
      // setRenameItemInfo(null);
    }
  };

  // Placeholder for Organize
  const handleOrganizeItem = (
    id: string,
    type: "file" | "folder",
    currentParentId: string | null
  ) => {
    const itemToOrganize =
      type === "file"
        ? files.find((f) => f._id === id)
        : folders.find((f) => f._id === id);

    if (!itemToOrganize) {
      toast({
        title: "Error",
        description: "Item not found.",
        variant: "destructive",
      });
      return;
    }

    setOrganizeItemInfo({
      id,
      type,
      itemName: itemToOrganize.name,
      currentParentId,
    });

    // Prepare available folders for moving:
    // Exclude the current folder itself if item is a folder
    // Exclude current parent of the item (handled by dialog UI not showing current parent as an option implicitly if desired)
    let filteredFolders = [...folders]; // Operate on a copy
    if (type === "folder") {
      filteredFolders = filteredFolders.filter((f) => f._id !== id);
      // TODO: Advanced - filter out children of this folder as well
    }
    setAvailableFoldersForMove(filteredFolders);
    setIsOrganizeDialogOpen(true);
  };

  const handleOrganizeSubmit = async (newParentId: string | null) => {
    if (!organizeItemInfo || !token) return;

    const { id, type, itemName } = organizeItemInfo;

    try {
      if (type === "file") {
        await filesApi.moveFile(token, id, newParentId);
      } else {
        // type === 'folder'
        await foldersApi.moveFolder(token, id, newParentId);
      }

      toast({
        title: "Success",
        description: `"${itemName}" moved successfully.`,
      });

      // Refresh the current view
      // await loadFilesAndFolders(); // Replaced by new logic
      if (refreshUserStorageInfo) {
        await refreshUserStorageInfo();
      }
      setFiles([]);
      setFolders([]);
      setCurrentPage(1);
      loadFilesAndFolders({ bustCache: true, pageToLoad: 1 });
    } catch (error) {
      console.error(`Error moving ${type}:`, error);
      toast({
        title: "Error",
        description: `Failed to move ${type}. ${
          error instanceof Error ? error.message : ""
        }`,
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

  const handleUploadFolder = (filesList: FileList) => {
    folderCache.clear(); // Clear folder cache at the start of a new folder upload
    if (isUploading || isUploadingFolder) {
      toast({
        title: "Upload in Progress",
        description:
          "Please wait for the current upload to complete before starting another.",
        variant: "destructive",
      });
      return;
    }
    console.log("Folder selected, raw FileList:", filesList);

    const processedFiles: ProcessedFile[] = [];
    if (filesList) {
      for (let i = 0; i < filesList.length; i++) {
        const file = filesList[i];
        // Ensure webkitRelativePath exists and is a string
        // Ensure it's File from global scope for webkitRelativePath
        const globalFile = file as unknown as {
          webkitRelativePath?: string;
          name: string;
          size: number;
          type: string;
        };

        if (
          typeof globalFile.webkitRelativePath === "string" &&
          globalFile.webkitRelativePath
        ) {
          processedFiles.push({
            file: file as globalThis.File, // Cast back to globalThis.File for the object
            relativePath: globalFile.webkitRelativePath,
          });
        } else {
          console.warn(
            "File without webkitRelativePath encountered:",
            globalFile.name
          );
          processedFiles.push({
            file: file as globalThis.File,
            relativePath: globalFile.name, // Fallback
          });
        }
      }
    }

    console.log("Processed files for folder upload:", processedFiles);

    if (processedFiles.length > 0) {
      let totalSizeNeededForFolder = 0;
      for (const pf of processedFiles) {
        totalSizeNeededForFolder += pf.file.size;
      }

      if (
        user &&
        typeof user.storageLimit === "number" &&
        typeof user.storageUsed === "number"
      ) {
        if (user.storageUsed + totalSizeNeededForFolder > user.storageLimit) {
          toast({
            title: "Insufficient Storage for Folder",
            description: `The selected folder (${formatBytes(
              totalSizeNeededForFolder
            )}) exceeds your available storage (${formatBytes(
              user.storageLimit - user.storageUsed
            )}). Please upgrade your plan or free up space.`,
            variant: "destructive",
            duration: 9000,
            action: (
              <ToastAction
                altText="Upgrade"
                onClick={() => setIsUpgradeStorageDialogOpen(true)}
              >
                {" "}
                Upgrade Storage{" "}
              </ToastAction>
            ),
          });
          return;
        }
      } else {
        console.warn(
          "User storage information not available for client-side folder quota check. Proceeding with upload, backend will verify."
        );
      }

      setFolderUploadQueue(processedFiles);
      setTotalFilesToUploadInFolder(processedFiles.length);
      setProcessedFolderFilesCount(0);
      setCurrentUploadingFolderFile(null);
      setIsUploadingFolder(true); // This will trigger the useEffect

      toast({
        title: "Folder Upload Starting (Simulated)",
        description: `Preparing to "upload" ${processedFiles.length} files.`,
      });
    } else {
      setIsUploadingFolder(false); // Ensure this is reset if no files
      toast({
        title: "Empty Folder or No Files",
        description:
          "The selected folder is empty or no files could be processed.",
        variant: "default",
      });
    }
  };

  useEffect(() => {
    async function ensureFolderPathExists(
      relativePath: string, // e.g., "Photos/Summer/Beach" (folder path part only)
      initialParentId: string | null,
      token: string, // Token must be passed in
      toastFn: typeof toast // Pass the toast function
    ): Promise<string | null> {
      let currentParentId = initialParentId;
      if (!relativePath) return currentParentId; // No path to create, return initial parent

      const pathSegments = relativePath
        .split("/")
        .filter((segment) => segment.trim() !== "");

      for (const segment of pathSegments) {
        const cacheKey = `${currentParentId || "root"}/${segment}`;
        if (folderCache.has(cacheKey)) {
          currentParentId = folderCache.get(cacheKey)!;
          continue;
        }
        try {
          // console.log(`[ensureFolderPathExists] Creating folder: ${segment} under parent: ${currentParentId}`);
          const newFolder = await foldersApi.createFolder(
            token,
            segment,
            currentParentId
          );
          folderCache.set(cacheKey, newFolder._id);
          currentParentId = newFolder._id;
        } catch (error: any) {
          console.error(
            `[ensureFolderPathExists] Error creating folder ${segment} under ${currentParentId}:`,
            error
          );
          toastFn({
            // Use the passed toast function
            title: "Folder Creation Error",
            description: `Failed to create part of folder structure: ${segment}. Error: ${
              error.message || "Unknown error"
            }`,
            variant: "destructive",
          });
          return null; // Stop if any part of the path fails
        }
      }
      return currentParentId;
    }

    // const processNextFileInQueue = async () => { // Original function is now part of the IIFE below
    // }; // processNextFileInQueue removed, logic moved into IIFE

    if (isUploadingFolder && folderUploadQueue.length > 0) {
      if (isProcessingFolderQueue.current) {
        // console.log("[Folder Upload] Already processing queue, skipping this effect run.");
        return; // Already processing, don't start another concurrent run
      }

      isProcessingFolderQueue.current = true;
      // console.log("[Folder Upload] Lock acquired.");

      const fileToProcess = folderUploadQueue[0]; // Still peek at the first file
      // setCurrentUploadingFolderFile should be set here so UI updates before async ops
      // However, if the async op fails fast, it might look like it skipped.
      // For a smoother UX, it might be better to set it right before the actual async file operation
      // but for now, setting it before the IIFE.
      setCurrentUploadingFolderFile(fileToProcess.relativePath);
      // console.log(`[Folder Upload] Starting to process (with lock): ${fileToProcess.relativePath}`);

      (async () => {
        try {
          // Ensure token is valid before proceeding with operations that need it
          if (!token) {
            toast({
              title: "Authentication Error",
              description: "User token not found. Cannot upload.",
              variant: "destructive",
            });
            setIsUploadingFolder(false);
            setFolderUploadQueue([]);
            // isProcessingFolderQueue.current = false; // Handled by finally
            return;
          }

          const { file, relativePath } = fileToProcess; // Deconstruct after checking queue
          setCurrentUploadingFolderFile(relativePath); // Confirm current file for UI

          const pathParts = relativePath.split("/");
          pathParts.pop();
          const fileParentPath = pathParts.join("/");

          const targetFolderId = await ensureFolderPathExists(
            fileParentPath,
            currentFolder?._id || null,
            token,
            toast
          );

          if (targetFolderId === null && fileParentPath !== "") {
            // Check if folder creation failed and it wasn't for root
            toast({
              title: "Upload Error",
              description: `Failed to establish folder path for ${relativePath}. Stopping folder upload.`,
              variant: "destructive",
            });
            setIsUploadingFolder(false);
            setFolderUploadQueue([]);
            return;
          }

          if (
            user &&
            typeof user.storageLimit === "number" &&
            typeof user.storageUsed === "number"
          ) {
            if (user.storageUsed + file.size > user.storageLimit) {
              toast({
                title: "Insufficient Storage",
                description: `Cannot upload ${
                  file.name
                }. Required: ${formatBytes(
                  file.size
                )}, Available: ${formatBytes(
                  user.storageLimit - user.storageUsed
                )}. Stopping folder upload.`,
                variant: "destructive",
                action: (
                  <ToastAction
                    altText="Upgrade"
                    onClick={() => setIsUpgradeStorageDialogOpen(true)}
                  >
                    {" "}
                    Upgrade Storage{" "}
                  </ToastAction>
                ),
              });
              setIsUploadingFolder(false);
              setFolderUploadQueue([]);
              return;
            }
          }

          const cryptoKey = await getMasterCryptoKey();
          if (!cryptoKey) {
            toast({
              title: "Encryption Key Error",
              description:
                "Could not retrieve encryption key. Stopping folder upload.",
              variant: "destructive",
            });
            setIsUploadingFolder(false);
            setFolderUploadQueue([]);
            return;
          }

          const originalMimeType = getAccurateMimeType(file);
          const fileReader = new FileReader();
          const fileBuffer = await new Promise<ArrayBuffer>(
            (resolve, reject) => {
              fileReader.onload = () =>
                resolve(fileReader.result as ArrayBuffer);
              fileReader.onerror = () => reject(fileReader.error);
              fileReader.readAsArrayBuffer(file);
            }
          );

          const { iv, ciphertext } = await encryptFile(fileBuffer, cryptoKey);
          const encryptedBlob = new Blob([iv, ciphertext]);

          await filesApi.uploadFile(
            token,
            encryptedBlob,
            file.name,
            originalMimeType,
            targetFolderId
          );

          // Successful upload of this one file
          if (refreshUserStorageInfo) {
            await refreshUserStorageInfo();
          }
          // The state updates below will trigger the useEffect to re-run for the next file
          setFolderUploadQueue((prevQueue) => prevQueue.slice(1));
          setProcessedFolderFilesCount((prevCount) => prevCount + 1);
          // console.log(`[Folder Upload] "Completed" processing (with lock): ${relativePath}`);
        } catch (error: any) {
          console.error(
            `[Folder Upload] Error processing file ${fileToProcess.relativePath}:`,
            error
          );
          toast({
            title: "Upload Failed",
            description: `Could not upload file: ${
              fileToProcess.file.name
            }. Error: ${error.message || "Unknown error"}`,
            variant: "destructive",
          });
          setIsUploadingFolder(false);
          setFolderUploadQueue([]);
        } finally {
          // console.log("[Folder Upload] Releasing lock.");
          isProcessingFolderQueue.current = false;
        }
      })(); // End of async IIFE
    } else if (
      isUploadingFolder &&
      folderUploadQueue.length === 0 &&
      totalFilesToUploadInFolder > 0 &&
      processedFolderFilesCount === totalFilesToUploadInFolder
    ) {
      setIsUploadingFolder(false);
      setCurrentUploadingFolderFile(null);
      isProcessingFolderQueue.current = false; // Ensure lock is also released on successful completion
      // console.log("[Folder Upload] All files processed. Lock released.");
      toast({
        title: "Folder Upload Complete",
        description: `Successfully uploaded ${totalFilesToUploadInFolder} files.`,
      });

      // Simplified refresh logic
      if (currentPage === 1) {
        setFiles([]);
        setFolders([]);
        loadFilesAndFolders();
      } else {
        setCurrentPage(1);
      }
      // Note: refreshUserStorageInfo is already called after each successful file in the folder upload queue processing.
    } else if (!isUploadingFolder && isProcessingFolderQueue.current) {
      // Catch-all: if uploading was stopped externally but lock was somehow still true
      isProcessingFolderQueue.current = false;
      // console.log("[Folder Upload] Upload externally stopped. Lock released.");
    }
  }, [
    isUploadingFolder,
    folderUploadQueue,
    totalFilesToUploadInFolder,
    processedFolderFilesCount, // Added dependency
    token,
    currentFolder,
    user,
    getMasterCryptoKey,
    refreshUserStorageInfo,
    loadFilesAndFolders, // Added dependency
    toast,
    setIsUpgradeStorageDialogOpen, // Added dependency
  ]);

  // Placeholder functions for bulk actions
  const handleBulkDownload = async () => {
    if (selectedItems.size === 0) {
      toast({
        title: "No Items Selected",
        description: "Please select items to download.",
        variant: "default",
      });
      return;
    }

    const filesToDownload: File[] = [];
    for (const itemId of selectedItems) {
      const file = files.find((f) => f._id === itemId);
      if (file) {
        filesToDownload.push(file);
      }
    }

    if (filesToDownload.length === 0) {
      toast({
        title: "No Files Selected",
        description: "Only files can be downloaded. No files were found in your selection.",
        variant: "default",
      });
      return;
    }

    for (const fileToDownload of filesToDownload) {
      try {
        // Assuming handleDownloadFile shows its own toasts for success/failure per file
        await handleDownloadFile(
          fileToDownload._id,
          fileToDownload.name,
          fileToDownload.type
        );
      } catch (error) {
        // This catch is a fallback, as handleDownloadFile should manage its errors.
        console.error(
          `Error during bulk download for file ${fileToDownload.name}:`,
          error
        );
        toast({
          title: "Download Error",
          description: `Failed to initiate download for ${fileToDownload.name}.`,
          variant: "destructive",
        });
      }
    }

    setSelectedItems(new Set()); // Clear selection after initiating all downloads
    toast({
      title: "Bulk Download Started",
      description: `Initiated download for ${filesToDownload.length} file(s).`,
    });
  };

  const handleBulkDelete = async () => {
    if (selectedItems.size === 0) {
      toast({
        title: "No Items Selected",
        description: "Please select items to delete.",
        variant: "default",
      });
      return;
    }

    if (
      !window.confirm(
        `Are you sure you want to delete ${selectedItems.size} item(s)? This will move them to trash.`
      )
    ) {
      return;
    }
    setDeleteOpId(Date.now()); // Signal bulk delete operation

    const itemsToDelete = Array.from(selectedItems); // Create a copy for iteration
    let deletedCount = 0;
    // It's important to await each deletion if they modify the same underlying data
    // or if subsequent operations depend on the completion of previous ones.
    // The current handleDeleteFile/Folder functions trigger individual reloads.
    // This will cause multiple reloads. A future optimization would be to
    // batch the API calls and do a single reload.
    for (const itemId of itemsToDelete) {
      const isFile = files.some((f) => f._id === itemId);
      const isFolder = folders.some((fo) => fo._id === itemId);

      try {
        if (isFile) {
          await handleDeleteFile(itemId); // Assumes this function handles its own errors/toasts
          deletedCount++;
        } else if (isFolder) {
          await handleDeleteFolder(itemId); // Assumes this function handles its own errors/toasts
          deletedCount++;
        } else {
          console.warn(`Item with ID ${itemId} not found as file or folder.`);
          // Optionally, show a toast for items not found if necessary
        }
      } catch (error) {
        // This catch block might be redundant if handleDeleteFile/Folder handle their own errors.
        // However, it's here as a safeguard for unexpected issues during the loop.
        console.error(`Error during bulk delete for item ${itemId}:`, error);
        toast({
          title: "Deletion Error",
          description: `Failed to delete item ${itemId}.`,
          variant: "destructive",
        });
      }
    }

    setSelectedItems(new Set()); // Clear selection
    toast({
      title: "Bulk Delete Complete",
      description: `${deletedCount} item(s) moved to trash.`,
    });
    // Note: The list will be reloaded multiple times by individual delete handlers.
    // This is not optimal but is the current behavior of those handlers.
    // For a better UX, batch API calls and then do a single refresh.
  };

  // Handler for item selection
  const handleItemSelect = (itemId: string) => {
    setSelectedItems((prevSelectedItems) => {
      const newSelectedItems = new Set(prevSelectedItems);
      if (newSelectedItems.has(itemId)) {
        newSelectedItems.delete(itemId);
      } else {
        newSelectedItems.add(itemId);
      }
      return newSelectedItems;
    });
  };

  // Handler to clear all selected items
  const handleClearSelection = () => {
    setSelectedItems(new Set());
  };

  // Handler to select all current files and folders
  const handleSelectAll = () => {
    const allItemIds = new Set<string>();
    files.forEach(file => allItemIds.add(file._id));
    folders.forEach(folder => allItemIds.add(folder._id));
    setSelectedItems(allItemIds);
  };

  // Determine if all items are selected
  const totalNumberOfItems = files.length + folders.length;
  const areAllItemsSelected = selectedItems.size > 0 && selectedItems.size === totalNumberOfItems;
  const hasSelection = selectedItems.size > 0;
  const hasItems = files.length > 0 || folders.length > 0;

  // Define the actual refresh logic for this component
  const performDataRefresh = useCallback(async () => {
    console.log("[Dashboard] Performing data refresh...");
    // Ensure refreshUserStorageInfo is awaited if it's async
    if (refreshUserStorageInfo) {
      await refreshUserStorageInfo();
    }
    // Assuming loadFilesAndFolders handles its own loading states.
    // It should also probably reset files/folders and page number if called externally like this.
    // The current loadFilesAndFolders is complex; a simpler top-level refresh might be:
    // setCurrentPage(1); // This will trigger its own useEffect to load page 1
    // loadFilesAndFolders({ bustCache: true, pageToLoad: 1 });
    // For now, directly call with options ensuring it refreshes page 1.
    await loadFilesAndFolders({ bustCache: true, pageToLoad: 1 });
  }, [loadFilesAndFolders, refreshUserStorageInfo]);

  // Register the refresh function with the context
  useEffect(() => {
    registerDataRefreshFunction(performDataRefresh);
    // Cleanup: Unregister or set to null if Dashboard unmounts, though typically Dashboard is long-lived.
    // return () => registerDataRefreshFunction(async () => {}); // Or some other way to clear
  }, [registerDataRefreshFunction, performDataRefresh]);


  // Effect for scroll restoration
  useEffect(() => {
    if (viewMode === 'card' && scrollPositionRef.current !== null && !loading) {
      const restoreScroll = () => {
        if (scrollPositionRef.current !== null && scrollableContainerRef.current) {
          scrollableContainerRef.current.scrollTo(0, scrollPositionRef.current);
          scrollPositionRef.current = null;
        }
      };
      requestAnimationFrame(restoreScroll);
    } else if (viewMode === 'list') {
      // When in list view, ensure dashboard's scrollPositionRef is cleared
      // as FileGrid's react-window will handle its own scrolling.
      scrollPositionRef.current = null;
    }
  }, [files, folders, loading, viewMode]); // Add viewMode to dependencies

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">
          {searchQuery
            ? `Search results for "${searchQuery}"`
            : currentFolder
            ? currentFolder.name
            : "My Drive"}
        </h2>
      </div>

      {/* Removed placeholder for sticky toolbar */}
      {/* toolbarRef and isToolbarSticky props removed from FilesToolbar */}
      <FilesToolbar
        currentFolder={currentFolder}
        onNavigateUp={handleNavigateUp}
        onCreateFolder={handleCreateFolder}
        onUploadFiles={handleUploadFiles}
        onUploadFolder={handleUploadFolder}
        isUploading={isUploading}
        isUploadingFolder={isUploadingFolder} // Pass this down
        uploadProgress={uploadProgress}
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        onSearchSubmit={() => {
          // setCurrentPage(1) and setFiles([]) will be handled by the main useEffect for [searchQuery] change
          // The actual loadFilesAndFolders call will be triggered by that useEffect.
          // We just need to ensure searchQuery state is updated here if FilesToolbar doesn't do it internally.
          // Assuming FilesToolbar calls onSearchQueryChange which updates searchQuery state.
          // If onSearchSubmit in toolbar is meant to trigger immediate fetch,
          // then ensure currentPage is 1.
          if (currentPage !== 1) setCurrentPage(1);
          else loadFilesAndFolders(); // Trigger if already on page 1
        }}
        folderHistory={folderHistory}
        onBreadcrumbNavigate={handleBreadcrumbNavigate}
        viewMode={viewMode} // Pass viewMode
        onViewModeChange={setViewMode} // Pass handler
        reloadFilesAndFolders={() => {
          loadFilesAndFolders({ bustCache: true, pageToLoad: 1 }); // Trigger reload
        }}
        selectedItemsCount={selectedItems.size} // Pass selected items count
        onBulkDownload={handleBulkDownload} // Updated to actual bulk download handler
        onBulkDelete={handleBulkDelete} // Updated to actual bulk delete handler
        // Props for Select All Checkbox in Toolbar
        onSelectAll={handleSelectAll}
        onClearSelection={handleClearSelection}
        areAllItemsSelected={areAllItemsSelected}
        hasSelection={hasSelection}
        hasItems={hasItems}
      />

      {isUploadingFolder && (
        <div className="mt-4 p-4 border rounded-lg space-y-2">
          <h4 className="font-semibold">Uploading Folder...</h4>
          {currentUploadingFolderFile && (
            <p className="text-sm">
              Current file: {currentUploadingFolderFile}
            </p>
          )}
          <p className="text-sm">
            Progress: {processedFolderFilesCount} / {totalFilesToUploadInFolder}{" "}
            files
          </p>
          <Progress
            value={
              (processedFolderFilesCount / totalFilesToUploadInFolder) * 100
            }
            className="h-2"
          />
        </div>
      )}

      <div className="flex-1 overflow-auto" ref={scrollableContainerRef}>
        {loading ? (
          <div className="flex justify-center py-12">
            <Spinner className="h-12 w-12" />
          </div>
        ) : folders.length === 0 && files.length === 0 ? (
          <FilesEmptyState />
        ) : (
          <div className="mt-3 overflow-hidden shadow-lg p-2">
            <FileGrid
              folders={folders}
              files={files}
              onFolderClick={handleNavigateToFolder}
              onFileDelete={handleDeleteFile}
              // TODO: Pass handleDeleteFilePermanently if FileGrid needs to offer this for items
              // onFileDeletePermanently={handleDeleteFilePermanently}
              onFolderDelete={handleDeleteFolder}
              onFilePreview={handleFilePreview}
              onStarToggle={handleFileStarToggled}
              onRenameItem={handleRenameItem}
              onOrganizeItem={handleOrganizeItem}
              onDownloadFile={handleDownloadFile}
              currentParentId={currentFolder?._id || null}
              viewMode={viewMode}
              selectedItems={selectedItems} // Added for selection
              onItemSelect={handleItemSelect} // Added for selection
              deleteOpId={deleteOpId} // Pass deleteOpId
              // Props for select all
              onSelectAll={handleSelectAll}
              onClearSelection={handleClearSelection}
              areAllItemsSelected={areAllItemsSelected}
            />
            {isLoadingMore && (
              <div className="flex justify-center py-4">
                <Spinner className="h-8 w-8" />
              </div>
            )}
            {!hasMoreFiles && files.length > 0 && (
              <p className="text-center text-gray-500 py-4">
                No more files to load.
              </p>
            )}
          </div>
        )}

        {isPreviewLoading && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100]">
            {" "}
            {/* Ensure high z-index */}
            <Spinner className="h-12 w-12 text-white" />
          </div>
        )}
      </div>

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

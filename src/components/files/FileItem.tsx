import React, { useEffect, useState, useRef } from 'react'; // Added React and useRef
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import ItemContextMenu from "./ItemContextMenu";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/components/ui/use-toast";
// useAuth and cryptoUtils are not directly used here anymore for decryption if handled by parent
// import { useAuth } from "@/contexts/AuthContext";
// import { decryptFile } from "@/lib/cryptoUtils";
// generateImageThumbnail is now in the worker
// import { generateImageThumbnail } from "@/lib/imageUtils";
import { cn } from "@/lib/utils";
import { filesApi } from "@/services/api"; // Still needed for download
import { MyFileType as File } from "@/types"; // Renamed to avoid conflict with global File
import { formatDistanceToNow, parseISO, isValid } from "date-fns"; // Ensure these are imported
import {
  Download,
  File as FileIconLucide, // Renamed to avoid conflict
  FileText,
  Image as ImageIcon, // Renamed
  MoreVertical,
  Star,
  Trash2,
} from "lucide-react";
import { Spinner } from '../ui/Spinner'; // Assuming Spinner component

// Removed local thumbnailCache, will rely on props from Dashboard

interface FileItemProps {
  file: File; // Use aliased File type
  onDelete: () => void;
  onPreview: (file: File) => void;
  onStarToggle?: (fileId: string, newIsStarred: boolean) => void;
  onRename: (id: string, type: 'file' | 'folder', currentName: string) => void;
  onOrganize: (id: string, type: 'file' | 'folder', currentParentId: string | null) => void;
  currentParentId: string | null;
  // Thumbnail related props from Dashboard
  thumbnailUrl?: string;
  requestDecryptedFileForThumbnail: (
    fileId: string,
    callback: (args: { fileId: string; buffer?: ArrayBuffer; error?: string }) => void
  ) => Promise<void>;
  onThumbnailGenerated: (fileId: string, thumbnailUrl: string) => void;
}

const FileItem: React.FC<FileItemProps> = ({
  file,
  onDelete,
  onPreview,
  onStarToggle,
  onRename,
  onOrganize,
  currentParentId,
  thumbnailUrl, // From Dashboard's cache
  requestDecryptedFileForThumbnail,
  onThumbnailGenerated,
}) => {
  // const { token } = useAuth(); // Token might still be needed for direct operations like download
  const { toast } = useToast();
  const [isDownloading, setIsDownloading] = useState(false);
  const [isLoadingThumbnail, setIsLoadingThumbnail] = useState(false);
  const [displayThumbnailUrl, setDisplayThumbnailUrl] = useState<string | undefined>(thumbnailUrl);
  const [thumbnailAttemptedWithError, setThumbnailAttemptedWithError] = useState(false); // New state
  const objectUrlRef = useRef<string | null>(null); // To keep track of locally created object URLs if any

  useEffect(() => {
    // Reset error state when file ID changes
    setThumbnailAttemptedWithError(false);
  }, [file._id]);

  useEffect(() => {
    // Update display URL if the prop changes (e.g. cache in Dashboard updates)
    setDisplayThumbnailUrl(thumbnailUrl);
  }, [thumbnailUrl]);

  useEffect(() => {
    // Revoke old object URL if it exists from a previous render/effect
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }

    if (file.type.startsWith('image/') && !displayThumbnailUrl && !isLoadingThumbnail && !thumbnailAttemptedWithError) {
      setIsLoadingThumbnail(true);
      // console.log(`FileItem: Requesting decrypted buffer for ${file.name} (ID: ${file._id})`);
      requestDecryptedFileForThumbnail(file._id, ({ fileId, buffer, error: decryptionError }) => {
        if (decryptionError || !buffer) {
          console.error(`FileItem: Error requesting decrypted file for ${fileId}: ${decryptionError}`);
          setThumbnailAttemptedWithError(true); // Set error state
          setIsLoadingThumbnail(false);
          return;
        }

        // console.log(`FileItem: Received buffer for ${fileId}. Posting to worker.`);
        const worker = new Worker('/thumbnail.worker.js'); // Ensure this path is correct

        worker.onmessage = (e) => {
          const { fileId: workerFileId, thumbnailDataUrl: newThumbnailUrl, error: workerError } = e.data;
          if (workerFileId === file._id) {
            if (workerError) {
              console.error(`FileItem: Thumbnail worker error for ${file._id}: ${workerError}`);
              setThumbnailAttemptedWithError(true); // Set error state on worker error too
            } else if (newThumbnailUrl) {
              // console.log(`FileItem: Worker generated thumbnail for ${file._id}. Updating cache via onThumbnailGenerated.`);
              onThumbnailGenerated(file._id, newThumbnailUrl); // This updates Dashboard's cache
              // setDisplayThumbnailUrl(newThumbnailUrl); // Update local display URL. Dashboard prop update will also trigger this.
            }
            setIsLoadingThumbnail(false);
            worker.terminate();
          }
        };

        worker.onerror = (e) => {
          console.error(`FileItem: Worker instance error for ${file._id}:`, e.message);
          setThumbnailAttemptedWithError(true); // Set error state on worker instance error
          setIsLoadingThumbnail(false);
          worker.terminate();
        };

        // Transfer array buffer to worker
        worker.postMessage({ fileId: file._id, fileBuffer: buffer, fileType: file.type }, [buffer]);
      });
    } else if (!file.type.startsWith('image/')) {
      // Not an image, no thumbnail to load via worker
      setIsLoadingThumbnail(false); // Ensure loading is false
    }

    // Cleanup: If the component unmounts while worker is running, this won't directly terminate the worker above.
    // Proper worker lifecycle management for unmounting components is more complex.
    // For this scope, worker.terminate() in onmessage/onerror is the primary cleanup.
    return () => {
      if (objectUrlRef.current) { // Clean up local object URLs if any were created (not in this flow anymore)
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, [file._id, file.type, file.name, displayThumbnailUrl, isLoadingThumbnail, requestDecryptedFileForThumbnail, onThumbnailGenerated]);


  const fileIcon = getFileIcon(file.type);
  const fileColorClassName = getFileColorClassName(file.type);

  const handleDownload = async () => {
    // Assuming filesApi.downloadFile does not require token to be explicitly passed if setup in an interceptor
    // If not, you'd need to get token from useAuth()
    setIsDownloading(true);
    try {
      // TODO: Ensure filesApi.downloadFile is called correctly, it might need the token.
      // For now, assuming it's handled by an interceptor or similar.
      const blob = await filesApi.downloadFile(/* Pass token if needed */ file._id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.name;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error downloading file:", error);
      toast({
        title: "Download Error",
        description: "Failed to download file.",
        variant: "destructive",
      });
    } finally {
      setIsDownloading(false);
    }
  };

  function getFileIcon(type: string) {
    // Now that PDF might have its own thumbnail, adjust icon logic if needed,
    // or rely on thumbnailFailed to show the icon for PDFs if PDF thumbnailing fails.
    if (type.startsWith("image/") || type === "application/pdf") {
      // PDF might render its own thumb
      return ImageIcon; // Use generic image icon as placeholder or if thumb fails
    } else if (
      type.includes("document") || // More generic document check
      type.includes("text")
    ) {
      return FileText;
    } else {
      return FileIconLucide; // Use aliased name
    }
  }

  // Updated function to return Tailwind class names using CSS variables
  function getFileColorClassName(type: string): string {
    if (type.startsWith("image/")) {
      return "text-[var(--file-icon-image)]";
    } else if (type.includes("pdf")) {
      return "text-[var(--file-icon-pdf)]";
    } else if (type.includes("document") || type.includes("text")) {
      return "text-[var(--file-icon-document)]";
    } else {
      return "text-[var(--file-icon-default)]";
    }
  }

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + " B";
    else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
    else if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + " MB";
    else return (bytes / 1073741824).toFixed(1) + " GB";
  }

  const FileIconComponent = fileIcon;

  // Robust date parsing logic
  let displayDate = 'Unknown date';
  if (file.updatedAt) {
    let dateObj;
    // Check if file.updatedAt is a string before attempting to parse with parseISO
    if (typeof file.updatedAt === 'string') {
      dateObj = parseISO(file.updatedAt);
    } else if (typeof file.updatedAt === 'number') {
      // If it's a number, assume it's a Unix timestamp (milliseconds)
      dateObj = new Date(file.updatedAt);
    }
    // Add other type checks or conversions if necessary

    if (dateObj && isValid(dateObj)) {
      displayDate = formatDistanceToNow(dateObj, { addSuffix: true });
    } else {
      // Log an error or warning if the date is invalid
      console.warn(`Invalid or unparseable date for file.updatedAt: ${file.updatedAt}, typeof: ${typeof file.updatedAt}`);
      displayDate = 'Invalid date'; // Or keep 'Unknown date'
    }
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger>
        <Card className="overflow-hidden transition-all duration-200 hover:shadow-md">
          <CardContent className="p-0">
            <div
          className="aspect-square flex items-center justify-center bg-muted/30 cursor-pointer"
          onClick={() => onPreview(file)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") onPreview(file);
          }}
        >
          {isLoadingThumbnail ? (
            <Spinner size="medium" />
          ) : displayThumbnailUrl && file.type.startsWith('image/') ? (
            <img
              src={displayThumbnailUrl}
              alt={`Thumbnail for ${file.name}`}
              className="w-full h-full object-contain"
              onError={() => {
                console.warn(
                  `FileItem: Img onError for ${file.name}. URL: ${displayThumbnailUrl}`
                );
                // Potentially set a flag to show icon instead
                setDisplayThumbnailUrl(undefined); // Fallback to icon
                setIsLoadingThumbnail(false); // Reset loading if image load fails
              }}
            />
          ) : (
            <FileIconComponent
              className={cn("h-16 w-16 opacity-80", fileColorClassName)}
            />
          )}
        </div>
      </CardContent>
      <CardFooter className="p-2 flex-col items-start gap-1">
        <div className="w-full flex justify-between items-start">
          <div className="truncate flex-1">
            <h3 className="text-sm font-medium truncate" title={file.name}>
              {file.name}
            </h3>
            <p className="text-xs text-muted-foreground">
              {formatFileSize(file.size)}
            </p>
          </div>
          <div className="flex items-center">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 mr-1"
              onClick={() =>
                onStarToggle && onStarToggle(file._id, !file.isStarred)
              }
              aria-label={file.isStarred ? "Unstar file" : "Star file"}
            >
              <Star
                className={cn(
                  "h-5 w-5",
                  file.isStarred
                    ? "text-yellow-400 fill-yellow-400"
                    : "text-muted-foreground hover:text-yellow-400"
                )}
              />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={handleDownload}
                  disabled={isDownloading}
                >
                  <Download className="mr-2 h-4 w-4" />
                  <span>Download</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => onDelete()}
                  className="text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  <span>Delete</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        {/* Added console.log for debugging updatedAt */}
        <p className="text-xs text-muted-foreground">
          Modified{" "}
          {console.log('FileItem updatedAt:', file.updatedAt, 'typeof:', typeof file.updatedAt)}
          {displayDate}
        </p>
      </CardFooter>
        </Card>
      </ContextMenuTrigger>
      <ItemContextMenu
        itemType="file"
        itemId={file._id}
        itemName={file.name}
        currentParentId={currentParentId} // Added
        onDelete={() => onDelete()} // Call the FileItem's onDelete
        onRename={onRename} // Pass down from FileGrid
        onOrganize={onOrganize} // Pass down from FileGrid
      />
    </ContextMenu>
  );
};

export default FileItem;

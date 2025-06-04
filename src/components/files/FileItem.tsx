import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import ItemContextMenu from "./ItemContextMenu"; // Import ItemContextMenu
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { decryptFile } from "@/lib/cryptoUtils";
import { generateImageThumbnail } from "@/lib/imageUtils";
import { cn } from "@/lib/utils";
import { filesApi } from "@/services/api";
import { MyFileType } from "@/types";
import { formatDistanceToNow } from "date-fns";
import {
  Download,
  File as FileIcon,
  FileText,
  Image,
  MoreVertical,
  Star,
  Trash2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

// Define the cache for thumbnails - Stores Blob objects now
const thumbnailCache = new Map<string, Blob>();

interface FileItemProps {
  file: MyFileType;
  onDelete: () => void;
  onPreview: (file: MyFileType) => void;
  onStarToggle?: (fileId: string, newIsStarred: boolean) => void;
  onRename: (id: string, type: 'file' | 'folder', currentName: string) => void;
  onOrganize: (id: string, type: 'file' | 'folder', currentParentId: string | null) => void; // Modified
  currentParentId: string | null; // Added
}

const FileItem: React.FC<FileItemProps> = ({
  file,
  onDelete,
  onPreview,
  onStarToggle,
  onRename,
  onOrganize, // Modified
  currentParentId, // Added
}) => {
  const { token, getMasterCryptoKey } = useAuth();
  const [thumbnailObjectUrl, setThumbnailObjectUrl] = useState<string | null>(
    null
  );
  const currentObjectUrlRef = useRef<string | null>(null);
  const { toast } = useToast();
  const [isDownloading, setIsDownloading] = useState(false);
  const [thumbnailFailed, setThumbnailFailed] = useState(false);
  const [encryptedFileBuffer, setEncryptedFileBuffer] =
    useState<ArrayBuffer | null>(null);
  const [isLoadingFullFile, setIsLoadingFullFile] = useState(false);

  useEffect(() => {
    setThumbnailObjectUrl(null);
    setThumbnailFailed(false);
    setEncryptedFileBuffer(null);

    if (
      token &&
      (file.type.startsWith("image/") || file.type === "application/pdf")
    ) {
      // MODIFIED
      setIsLoadingFullFile(true);
      const loadEncryptedFile = async () => {
        try {
          const blob = await filesApi.downloadFile(token, file._id);
          const buffer = await blob.arrayBuffer();
          setEncryptedFileBuffer(buffer);
        } catch (error) {
          console.error(
            `Error fetching encrypted file for ${file.name} (ID: ${file._id}):`,
            error
          );
          setThumbnailFailed(true);
        } finally {
          setIsLoadingFullFile(false);
        }
      };
      loadEncryptedFile();
    } else if (
      !(file.type.startsWith("image/") || file.type === "application/pdf")
    ) {
      // MODIFIED
      setThumbnailFailed(true);
    } else if (!token) {
      setThumbnailFailed(true);
    }

    return () => {
      // Minimal cleanup here; object URL revocation is handled by the effect that creates it.
    };
  }, [file, token]);

  useEffect(() => {
    if (currentObjectUrlRef.current) {
      URL.revokeObjectURL(currentObjectUrlRef.current);
      currentObjectUrlRef.current = null;
    }
    setThumbnailObjectUrl(null);

    if (
      encryptedFileBuffer &&
      (file.type.startsWith("image/") || file.type === "application/pdf")
    ) {
      const cacheKey = file._id + '_' + new Date(file.updatedAt).getTime();
      if (thumbnailCache.has(cacheKey)) {
        const cachedBlob = thumbnailCache.get(cacheKey);
        if (cachedBlob) {
          const newObjectUrl = URL.createObjectURL(cachedBlob);
          setThumbnailObjectUrl(newObjectUrl);
          currentObjectUrlRef.current = newObjectUrl;
          setThumbnailFailed(false); // Ensure failed state is reset if cache hit is successful
          // console.log(`FileItem: Used cached BLOB for ${file.name} (ID: ${file._id})`);
          return; // Return early as we found a valid blob in cache
        }
        // If cachedBlob was undefined (shouldn't happen if .has was true, but good practice)
        // console.warn(`FileItem: Cache had key for ${file.name} but blob was undefined. Regenerating.`);
      }
      // console.log(`FileItem: Cache miss or invalid blob for ${file.name} (ID: ${file._id}). Generating.`);

      // MODIFIED
      const processEncryptedBuffer = async () => {
        const actualMasterKey = await getMasterCryptoKey();

        if (!actualMasterKey) {
          console.warn(
            `FileItem: MasterKey not available after call for ${file.name}. Cannot generate thumbnail.`
          );
          setThumbnailFailed(true);
          return;
        }

        setThumbnailFailed(false);

        const decryptAndGenerateThumb = async () => {
          try {
            const decryptedBuffer = await decryptFile(
              encryptedFileBuffer,
              actualMasterKey
            );

            if (decryptedBuffer && decryptedBuffer.byteLength > 0) {
              const decryptedBlob = new Blob([decryptedBuffer], {
                type: file.type, // Use original file type for Blob
              });
              // Pass original file.type to generateImageThumbnail, it will handle HEIC/PDF detection
              const tempFileForThumbnail = new window.File(
                [decryptedBlob],
                file.name,
                { type: file.type }
              );

              const thumbnailBlob = await generateImageThumbnail(
                tempFileForThumbnail,
                256, // maxWidth
                256, // maxHeight
                file.type // Pass original file.type; imageUtils will decide output format
              );

              if (thumbnailBlob) {
                thumbnailCache.set(cacheKey, thumbnailBlob); // Store the Blob in cache
                const objectUrl = URL.createObjectURL(thumbnailBlob); // Create ObjectURL for this instance
                setThumbnailObjectUrl(objectUrl);
                currentObjectUrlRef.current = objectUrl;
              } else {
                console.error(
                  `FileItem: generateImageThumbnail returned null for ${file.name}.`
                );
                setThumbnailFailed(true);
              }
            } else {
              console.error(
                `FileItem: Decryption returned null or buffer was empty for ${file.name}.`
              );
              setThumbnailFailed(true);
            }
          } catch (error) {
            console.error(
              `FileItem: Error during decryption or thumbnail generation for ${file.name}:`,
              error
            );
            setThumbnailFailed(true);
          }
        };
        await decryptAndGenerateThumb();
      };
      processEncryptedBuffer();
    } else if (
      (file.type.startsWith("image/") || file.type === "application/pdf") &&
      !encryptedFileBuffer
    ) {
      // MODIFIED
      // console.log(`FileItem SecondEffect: Image/PDF file ${file.name}, but encryptedFileBuffer is not yet available.`);
    }

    return () => {
      if (currentObjectUrlRef.current) {
        URL.revokeObjectURL(currentObjectUrlRef.current);
        currentObjectUrlRef.current = null;
      }
    };
  }, [encryptedFileBuffer, file, getMasterCryptoKey]);

  const fileIcon = getFileIcon(file.type);
  const fileColor = getFileColor(file.type);

  const handleDownload = async () => {
    if (!token) return;
    setIsDownloading(true);
    try {
      const blob = await filesApi.downloadFile(token, file._id);
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
      return Image; // Use generic image icon as placeholder or if thumb fails
    } else if (
      type.includes("document") || // More generic document check
      type.includes("text")
    ) {
      return FileText;
    } else {
      return FileIcon;
    }
  }

  function getFileColor(type: string) {
    if (type.startsWith("image/")) {
      return "#34A853"; // Green
    } else if (type.includes("pdf")) {
      // Keep PDF color for icon fallback
      return "#EA4335"; // Red
    } else if (type.includes("document") || type.includes("text")) {
      return "#4285F4"; // Blue
    } else {
      return "#FBBC05"; // Yellow
    }
  }

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + " B";
    else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
    else if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + " MB";
    else return (bytes / 1073741824).toFixed(1) + " GB";
  }

  const FileIconComponent = fileIcon;

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
          {(file.type.startsWith("image/") ||
            file.type === "application/pdf") && // MODIFIED
          thumbnailObjectUrl &&
          !thumbnailFailed ? (
            <img
              src={thumbnailObjectUrl}
              alt={`Thumbnail for ${file.name}`}
              className="w-full h-full object-contain"
              onError={() => {
                console.warn(
                  `Image tag onError for file: ${file.name}. URL: ${thumbnailObjectUrl}`
                );
                setThumbnailFailed(true);
              }}
            />
          ) : (
            <FileIconComponent
              style={{ color: fileColor }}
              className="h-16 w-16 opacity-80"
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
          {file.updatedAt ? formatDistanceToNow(new Date(file.updatedAt), { addSuffix: true }) : 'Unknown date'}
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

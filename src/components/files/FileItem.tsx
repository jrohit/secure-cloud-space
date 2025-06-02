import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/components/ui/use-toast"; // Added useToast
import { useAuth } from "@/contexts/AuthContext";
import { decryptFile } from "@/lib/cryptoUtils"; // Added
import { generateImageThumbnail } from "@/lib/imageUtils"; // Added
import { cn } from "@/lib/utils"; // Added cn
import { filesApi } from "@/services/api";
import { MyFileType } from "@/types"; // Changed from File
import { formatDistanceToNow } from "date-fns";
import {
  Download,
  File as FileIcon,
  FileText,
  Image,
  MoreVertical,
  Star,
  Trash2,
} from "lucide-react"; // Added Star
import { useEffect, useRef, useState } from "react";

interface FileItemProps {
  file: MyFileType; // Changed from File
  onDelete: () => void;
  onPreview: (file: MyFileType) => void; // Changed from File
  onStarToggle?: (fileId: string, newIsStarred: boolean) => void; // Added
}

const FileItem: React.FC<FileItemProps> = ({
  file,
  onDelete,
  onPreview,
  onStarToggle,
}) => {
  const { token, masterKey } = useAuth(); // Added masterKey
  const [thumbnailObjectUrl, setThumbnailObjectUrl] = useState<string | null>(
    null
  );
  const currentObjectUrlRef = useRef<string | null>(null); // To manage cleanup for the Object URL
  const { toast } = useToast(); // Added
  const [isDownloading, setIsDownloading] = useState(false);
  const [thumbnailFailed, setThumbnailFailed] = useState(false);
  const [encryptedFileBuffer, setEncryptedFileBuffer] =
    useState<ArrayBuffer | null>(null);
  const [isLoadingFullFile, setIsLoadingFullFile] = useState(false);

  useEffect(() => {
    // Cleanup previous object URL before starting new load or if file/token changes
    if (currentObjectUrlRef.current) {
      URL.revokeObjectURL(currentObjectUrlRef.current);
      currentObjectUrlRef.current = null;
    }
    setThumbnailObjectUrl(null); // Reset object URL state
    setThumbnailFailed(false); // Reset failed state
    setEncryptedFileBuffer(null); // Reset encrypted file buffer

    if (file.type.startsWith("image/") && token) {
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
          setThumbnailFailed(true); // Use thumbnailFailed to indicate error for now
        } finally {
          setIsLoadingFullFile(false);
        }
      };

      loadEncryptedFile();
    } else if (!file.type.startsWith("image/")) {
      // Not an image, so no thumbnail to attempt loading.
      // Setting thumbnailFailed to true will ensure the icon fallback is shown.
      setThumbnailFailed(true);
    } else if (!token) {
      // No token is available (e.g., user logged out).
      console.warn(
        `No token available to fetch data for ${file.name} (ID: ${file._id})`
      );
      setThumbnailFailed(true);
    }

    // Cleanup function for when component unmounts or dependencies (file, token) change before next run
    return () => {
      if (currentObjectUrlRef.current) {
        URL.revokeObjectURL(currentObjectUrlRef.current);
        currentObjectUrlRef.current = null;
        // Note: encryptedFileBuffer is managed by state and doesn't need manual cleanup here
        // as it's not a URL.
      }
    };
  }, [file, token]); // Dependencies for the effect

  // New useEffect for decryption and thumbnail generation
  useEffect(() => {
    // Cleanup previous object URL before starting new processing or if dependencies change
    if (currentObjectUrlRef.current) {
      URL.revokeObjectURL(currentObjectUrlRef.current);
      currentObjectUrlRef.current = null;
    }
    setThumbnailObjectUrl(null); // Reset object URL state

    if (
      encryptedFileBuffer &&
      masterKey &&
      file.type.startsWith("image/")
    ) {
      setThumbnailFailed(false); // Reset failure state before attempting

      const processFile = async () => {
        try {
          const decryptedBuffer = await decryptFile(
            encryptedFileBuffer,
            masterKey
          );
          if (decryptedBuffer) {
            const decryptedBlob = new Blob([decryptedBuffer], {
              type: file.type,
            });
            const tempFileForThumbnail = new window.File( // Use window.File to avoid conflict
              [decryptedBlob],
              file.name,
              { type: file.type }
            );

            const thumbnailBlob = await generateImageThumbnail(
              tempFileForThumbnail,
              100,
              100,
              file.type
            );

            if (thumbnailBlob) {
              const objectUrl = URL.createObjectURL(thumbnailBlob);
              setThumbnailObjectUrl(objectUrl);
              currentObjectUrlRef.current = objectUrl; // Store for cleanup
            } else {
              console.error(
                `generateImageThumbnail returned null for ${file.name}`
              );
              setThumbnailFailed(true);
            }
          } else {
            // This case should ideally be caught by the catch block in decryptFile
            console.error(`Decryption returned null for ${file.name}`);
            setThumbnailFailed(true);
          }
        } catch (error) {
          console.error(
            `Error during decryption or thumbnail generation for ${file.name}:`,
            error
          );
          setThumbnailFailed(true);
        }
      };

      processFile();
    } else if (!file.type.startsWith("image/")) {
      // This check might be redundant if the first useEffect already handles it,
      // but ensures icon fallback for non-images.
      setThumbnailFailed(true);
    }
    // No specific cleanup for encryptedFileBuffer here as it's managed by the first useEffect
    // when file or token changes. This effect focuses on object URL from the buffer.
  }, [encryptedFileBuffer, masterKey, file.name, file.type]); // Added file.name and file.type for consistency

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
    } finally {
      setIsDownloading(false);
    }
  };

  function getFileIcon(type: string) {
    if (type.startsWith("image/")) {
      return Image;
    } else if (
      type.includes("pdf") ||
      type.includes("document") ||
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
          {/* Conditional rendering for thumbnail or icon */}
          {file.type.startsWith("image/") &&
          thumbnailObjectUrl &&
          !thumbnailFailed ? (
            <img
              src={thumbnailObjectUrl} // Use object URL from state
              alt={`Thumbnail for ${file.name}`}
              className="w-full h-full object-contain" // Or object-cover if preferred
              onError={() => {
                console.warn(
                  `[ImgTagDebug] onError triggered for file: ${file.name}.`
                );
                // Log the state of relevant variables at the moment onError is called
                console.log(
                  `[ImgTagDebug] At time of img.onError - thumbnailObjectUrl (state): ${thumbnailObjectUrl}`
                );
                console.log(
                  `[ImgTagDebug] At time of img.onError - currentObjectUrlRef.current: ${currentObjectUrlRef.current}`
                );

                setThumbnailFailed(true);
                // For this diagnostic step, we are intentionally not revoking the object URL here
                // to see if it persists and was valid. The main useEffect cleanup will handle it.
              }}
            />
          ) : (
            <FileIconComponent
              style={{ color: fileColor }} // Ensure fileColor is defined as in original code
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
            {" "}
            {/* Container for star and dropdown */}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 mr-1" // Added margin for spacing
              onClick={() => {}}
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
                  onClick={onDelete}
                  className="text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  <span>Delete</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Modified{" "}
          {formatDistanceToNow(new Date(file.updatedAt), { addSuffix: true })}
        </p>
      </CardFooter>
    </Card>
  );
};

export default FileItem;

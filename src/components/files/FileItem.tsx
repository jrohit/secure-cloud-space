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
import { cn } from "@/lib/utils"; // Added cn
import { filesApi } from "@/services/api";
import { File } from "../../types";
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
import { useState, useEffect, useRef } from "react";
import { generateImageThumbnail } from "@/lib/imageUtils";
import { decryptFile, base64ToArrayBuffer } from "@/lib/cryptoUtils";

interface FileItemProps {
  file: File;
  onDelete: () => void;
  onPreview: (file: File) => void;
  onStarToggle?: (fileId: string, newIsStarred: boolean) => void; // Added
}

const FileItem: React.FC<FileItemProps> = ({
  file,
  onDelete,
  onPreview,
  onStarToggle,
}) => {
  const { token, masterKey: masterKeyString } = useAuth(); // masterKeyString might be base64
  const [thumbnailObjectUrl, setThumbnailObjectUrl] = useState<string | null>(null);
  const currentObjectUrlRef = useRef<string | null>(null);
  const { toast } = useToast();
  const [isDownloading, setIsDownloading] = useState(false);
  const [thumbnailFailed, setThumbnailFailed] = useState(false);

  useEffect(() => {
    // 1. Initial Cleanup
    if (currentObjectUrlRef.current) {
      URL.revokeObjectURL(currentObjectUrlRef.current);
      currentObjectUrlRef.current = null;
    }
    setThumbnailObjectUrl(null);
    setThumbnailFailed(false);

    // 2. Check if it's an image
    if (!file.type.startsWith("image/")) {
      setThumbnailFailed(true);
      return;
    }

    // 3. Local Storage Cache Key
    const cacheKey = `thumbnail_${file._id}`;

    // 4. Check Local Storage
    const cachedThumbnailDataUrl = localStorage.getItem(cacheKey);
    if (cachedThumbnailDataUrl) {
      fetch(cachedThumbnailDataUrl)
        .then((res) => res.blob())
        .then((blob) => {
          const objectUrl = URL.createObjectURL(blob);
          setThumbnailObjectUrl(objectUrl);
          currentObjectUrlRef.current = objectUrl;
        })
        .catch((error) => {
          console.error("Error creating blob from cached data URL:", error);
          localStorage.removeItem(cacheKey); // Remove corrupted cache
          setThumbnailFailed(true); // Proceed to generate if cache fails
        });
      return; // Return if cache hit and successfully processed
    }

    // 5. If not in Local Storage (and is an image and token/masterKeyString exist)
    if (!token || !masterKeyString) {
        console.warn("Token or master key not available for thumbnail generation.");
        setThumbnailFailed(true);
        return;
    }

    const generateAndCacheThumbnail = async () => {
      try {
        // 5.1 Fetch Encrypted File
        const encryptedFileBlob = await filesApi.downloadFile(token, file._id);

        // 5.2 Decryption
        const masterCryptoKey = await window.crypto.subtle.importKey(
          "raw",
          base64ToArrayBuffer(masterKeyString),
          { name: "AES-GCM", length: 256 },
          true,
          ["encrypt", "decrypt"]
        );

        const encryptedFileArrayBuffer = await encryptedFileBlob.arrayBuffer();
        const decryptedArrayBuffer = await decryptFile(
          encryptedFileArrayBuffer,
          masterCryptoKey
        );

        // 5.3 Thumbnail Generation
        const decryptedFile = new File(
          [decryptedArrayBuffer],
          file.name,
          { type: file.type }
        );
        const thumbnailBlob = await generateImageThumbnail(decryptedFile, 100, 100); // Adjust dimensions as needed

        // 5.4 Caching and Display
        if (thumbnailBlob) {
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64data = reader.result as string;
            try {
              localStorage.setItem(cacheKey, base64data); // Store Base64 string
            } catch (e) {
              console.error("Error saving thumbnail to localStorage:", e);
              // Could be due to storage limit
            }
            const objectUrl = URL.createObjectURL(thumbnailBlob);
            setThumbnailObjectUrl(objectUrl);
            currentObjectUrlRef.current = objectUrl;
          };
          reader.onerror = () => {
            console.error("FileReader error while converting blob to base64");
            setThumbnailFailed(true);
          };
          reader.readAsDataURL(thumbnailBlob);
        } else {
          setThumbnailFailed(true);
        }
      } catch (error) {
        console.error(`Error generating thumbnail for ${file.name}:`, error);
        setThumbnailFailed(true);
      }
    };

    generateAndCacheThumbnail();

    // Cleanup function
    return () => {
      if (currentObjectUrlRef.current) {
        URL.revokeObjectURL(currentObjectUrlRef.current);
        currentObjectUrlRef.current = null;
      }
    };
  }, [file, token, masterKeyString]); // Dependencies

  const fileIcon = getFileIcon(file.type);
  const fileColor = getFileColor(file.type);

  const handleDownload = async () => {
    if (!token) return;

    setIsDownloading(true);
    try {
      const encryptedBlob = await filesApi.downloadFile(token, file._id);

      if (!masterKeyString) {
        toast({
          title: "Error",
          description: "Master key not found. Cannot decrypt file.",
          variant: "destructive",
        });
        setIsDownloading(false);
        return;
      }

      try {
        const masterCryptoKey = await window.crypto.subtle.importKey(
          'raw',
          base64ToArrayBuffer(masterKeyString),
          { name: 'AES-GCM', length: 256 },
          true,
          ['encrypt', 'decrypt']
        );

        const encryptedBuffer = await encryptedBlob.arrayBuffer();
        const decryptedBuffer = await decryptFile(encryptedBuffer, masterCryptoKey);

        const decryptedBlob = new Blob([decryptedBuffer], { type: file.type });

        const url = window.URL.createObjectURL(decryptedBlob);
        const a = document.createElement("a");
        a.href = url;
        a.download = file.name;
        document.body.appendChild(a); // Required for Firefox
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a); // Clean up
      } catch (decryptionError) {
        console.error("Error decrypting file for download:", decryptionError);
        toast({
          title: "Decryption Failed",
          description: "Could not decrypt the file. Please check your master key.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error downloading file:", error);
      toast({
        title: "Download Failed",
        description: "An error occurred while trying to download the file.",
        variant: "destructive",
      });
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
          {file.type.startsWith('image/') && thumbnailObjectUrl && !thumbnailFailed ? (
              <img
                  src={thumbnailObjectUrl} // Use object URL from state
                  alt={`Thumbnail for ${file.name}`}
                  className="w-full h-full object-contain" // Or object-cover if preferred
                  onError={() => {
                      console.warn(`[ImgTagDebug] onError triggered for file: ${file.name}.`);
                      // Log the state of relevant variables at the moment onError is called
                      console.log(`[ImgTagDebug] At time of img.onError - thumbnailObjectUrl (state): ${thumbnailObjectUrl}`);
                      console.log(`[ImgTagDebug] At time of img.onError - currentObjectUrlRef.current: ${currentObjectUrlRef.current}`);
                      
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

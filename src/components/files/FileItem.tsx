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

interface FileItemProps {
  file: MyFileType;
  onDelete: () => void;
  onPreview: (file: MyFileType) => void;
  onStarToggle?: (fileId: string, newIsStarred: boolean) => void;
}

const FileItem: React.FC<FileItemProps> = ({
  file,
  onDelete,
  onPreview,
  onStarToggle,
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

    if (file.type.startsWith("image/") && token) {
      setIsLoadingFullFile(true);
      const loadEncryptedFile = async () => {
        try {
          const blob = await filesApi.downloadFile(token, file._id);
          const buffer = await blob.arrayBuffer();
          setEncryptedFileBuffer(buffer);
        } catch (error) {
          console.error(`Error fetching encrypted file for ${file.name}:`, error);
          setThumbnailFailed(true);
        } finally {
          setIsLoadingFullFile(false);
        }
      };
      loadEncryptedFile();
    } else if (!file.type.startsWith("image/")) {
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

    if (encryptedFileBuffer && file.type.startsWith("image/")) {
      const processEncryptedBuffer = async () => {
        const actualMasterKey = await getMasterCryptoKey();

        if (!actualMasterKey) {
          console.warn(`MasterKey not available for ${file.name}`);
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
                type: file.type,
              });
              const tempFileForThumbnail = new window.File(
                [decryptedBlob],
                file.name,
                { type: file.type }
              );

              const thumbnailBlob = await generateImageThumbnail(
                tempFileForThumbnail, 256, 256, file.type
              );

              if (thumbnailBlob) {
                const objectUrl = URL.createObjectURL(thumbnailBlob);
                setThumbnailObjectUrl(objectUrl);
                currentObjectUrlRef.current = objectUrl;
              } else {
                console.error(`generateImageThumbnail returned null for ${file.name}`);
                setThumbnailFailed(true);
              }
            } else {
              console.error(`Decryption returned null or buffer was empty for ${file.name}`);
              setThumbnailFailed(true);
            }
          } catch (error) {
            console.error(`Error during decryption or thumbnail generation for ${file.name}:`, error);
            setThumbnailFailed(true);
          }
        };
        await decryptAndGenerateThumb();
      };
      processEncryptedBuffer();

    } else if (file.type.startsWith("image/")) {
      // Image file, but encryptedFileBuffer is not yet available or master key missing
      if (!encryptedFileBuffer) {
        // console.log(`Image file ${file.name}, but encryptedFileBuffer is not yet available.`);
      }
      // If masterKey was the issue, it's handled above.
      // If it's simply not an image, the first effect sets thumbnailFailed.
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
      toast({ title: "Download Error", description: "Failed to download file.", variant: "destructive" });
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
          {file.type.startsWith("image/") &&
          thumbnailObjectUrl &&
          !thumbnailFailed ? (
            <img
              src={thumbnailObjectUrl}
              alt={`Thumbnail for ${file.name}`}
              className="w-full h-full object-contain"
              onError={() => {
                // Minimal log for this specific image load error
                console.warn(`Image tag onError for file: ${file.name}. URL: ${thumbnailObjectUrl}`);
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
              onClick={() => onStarToggle && onStarToggle(file._id, !file.isStarred)}
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
        <p className="text-xs text-muted-foreground">
          Modified{" "}
          {formatDistanceToNow(new Date(file.updatedAt), { addSuffix: true })}
        </p>
      </CardFooter>
    </Card>
  );
};

export default FileItem;

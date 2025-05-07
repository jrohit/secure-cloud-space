import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/AuthContext";
import { filesApi } from "@/services/api";
import { File } from "@/types";
import { Download, MoreVertical, RotateCcw, Star, Trash2 } from "lucide-react";
import { userEncryptionService } from "@/services/api/userEncryption";

interface FileItemProps {
  file: File;
  onClick: () => void;
  onDelete?: () => void;
  onStar?: () => void;
  onTrash?: () => void;
  onRestore?: () => void;
  viewMode: "grid" | "list";
}

const FileItem: React.FC<FileItemProps> = ({
  file,
  onClick,
  onDelete,
  onStar,
  onTrash,
  onRestore,
  viewMode,
}) => {
  const { token, user, masterKey } = useAuth();
  const [isDownloading, setIsDownloading] = useState(false);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [thumbnailError, setThumbnailError] = useState(false);
  const [decryptedFileName, setDecryptedFileName] = useState<string>(file.name);

  // Decrypt file name if needed
  useEffect(() => {
    if (masterKey && file.metadataEncrypted) {
      const decrypted = userEncryptionService.decryptName(file.name, masterKey);
      setDecryptedFileName(decrypted || file.name);
    } else {
      setDecryptedFileName(file.name);
    }
  }, [file.name, masterKey, file.metadataEncrypted]);

  // Load thumbnail for images if in grid view
  useEffect(() => {
    if (viewMode === "grid" && file.type.startsWith("image/") && token && user) {
      const loadThumbnail = async () => {
        try {
          const url = await filesApi.getThumbnailUrl(token, file._id, user.id, masterKey);
          setThumbnailUrl(url);
        } catch (error) {
          console.error("Error loading thumbnail:", error);
          setThumbnailError(true);
        }
      };

      loadThumbnail();
    }
  }, [file._id, file.type, token, user?.id, viewMode, masterKey]);

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!token || !user) return;

    setIsDownloading(true);
    try {
      const blob = await filesApi.downloadFile(token, file._id, user.id, masterKey);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = decryptedFileName;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error downloading file:", error);
    } finally {
      setIsDownloading(false);
    }
  };

  const getFileIconClass = () => {
    if (file.type.startsWith("image/")) return "text-blue-500";
    if (file.type.startsWith("video/")) return "text-red-500";
    if (file.type.startsWith("audio/")) return "text-green-500";
    if (file.type === "application/pdf") return "text-orange-500";
    if (file.type.includes("spreadsheet") || file.type.includes("excel"))
      return "text-green-700";
    if (file.type.includes("document") || file.type.includes("word"))
      return "text-blue-700";
    if (file.type.includes("presentation") || file.type.includes("powerpoint"))
      return "text-orange-700";
    return "text-gray-500";
  };

  const getFileIcon = () => {
    if (file.type.startsWith("image/")) {
      return (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className={`h-8 w-8 ${getFileIconClass()}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
      );
    } else if (file.type.startsWith("video/")) {
      return (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className={`h-8 w-8 ${getFileIconClass()}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
          />
        </svg>
      );
    } else if (file.type.startsWith("audio/")) {
      return (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className={`h-8 w-8 ${getFileIconClass()}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
          />
        </svg>
      );
    } else {
      return (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className={`h-8 w-8 ${getFileIconClass()}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
          />
        </svg>
      );
    }
  };

  const renderThumbnail = () => {
    if (thumbnailUrl && !thumbnailError) {
      return (
        <img
          src={thumbnailUrl}
          alt={decryptedFileName}
          className="object-cover w-full h-full rounded-lg"
          onError={() => setThumbnailError(true)}
        />
      );
    }
    return (
      <div
        className={`flex items-center justify-center w-full h-full bg-muted rounded-lg`}
      >
        {getFileIcon()}
      </div>
    );
  };

  if (viewMode === "grid") {
    return (
      <div
        className={`group relative flex flex-col rounded-lg border bg-card p-2 transition-all hover:shadow-md ${
          file.isTrash ? "opacity-75" : ""
        }`}
        onClick={onClick}
      >
        <div className="absolute right-2 top-2 z-10">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 opacity-0 group-hover:opacity-100"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreVertical className="h-4 w-4" />
                <span className="sr-only">Open menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {!file.isTrash && (
                <>
                  <DropdownMenuItem onClick={handleDownload}>
                    <Download className="mr-2 h-4 w-4" />
                    Download
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={(e) => {
                    e.stopPropagation();
                    onStar?.();
                  }}>
                    <Star
                      className={`mr-2 h-4 w-4 ${
                        file.isStarred ? "fill-yellow-400 text-yellow-400" : ""
                      }`}
                    />
                    {file.isStarred ? "Unstar" : "Star"}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={(e) => {
                    e.stopPropagation();
                    onTrash?.();
                  }}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Move to trash
                  </DropdownMenuItem>
                </>
              )}
              {file.isTrash && (
                <>
                  <DropdownMenuItem onClick={(e) => {
                    e.stopPropagation();
                    onRestore?.();
                  }}>
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Restore
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete?.();
                    }}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete permanently
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="aspect-square mb-2 overflow-hidden rounded-lg">
          {renderThumbnail()}
        </div>

        <div className="flex items-start justify-between space-x-2 text-sm">
          <div className="truncate font-medium">
            {decryptedFileName}
            {file.isStarred && (
              <Star className="ml-1 inline-block h-3 w-3 fill-yellow-400 text-yellow-400" />
            )}
          </div>
        </div>
      </div>
    );
  } else {
    // List view
    return (
      <div
        className={`group flex items-center justify-between rounded-lg border bg-card p-2 transition-all hover:bg-accent ${
          file.isTrash ? "opacity-75" : ""
        }`}
        onClick={onClick}
      >
        <div className="flex items-center space-x-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-muted">
            {getFileIcon()}
          </div>
          <div>
            <div className="font-medium">
              {decryptedFileName}
              {file.isStarred && (
                <Star className="ml-1 inline-block h-3 w-3 fill-yellow-400 text-yellow-400" />
              )}
            </div>
            <div className="text-xs text-muted-foreground">
              {formatFileSize(file.size)} • {formatDate(file.updatedAt)}
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleDownload}>
            <Download className="h-4 w-4" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => e.stopPropagation()}>
                <MoreVertical className="h-4 w-4" />
                <span className="sr-only">Open menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {!file.isTrash && (
                <>
                  <DropdownMenuItem onClick={(e) => {
                    e.stopPropagation();
                    onStar?.();
                  }}>
                    <Star
                      className={`mr-2 h-4 w-4 ${
                        file.isStarred ? "fill-yellow-400 text-yellow-400" : ""
                      }`}
                    />
                    {file.isStarred ? "Unstar" : "Star"}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={(e) => {
                    e.stopPropagation();
                    onTrash?.();
                  }}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Move to trash
                  </DropdownMenuItem>
                </>
              )}
              {file.isTrash && (
                <>
                  <DropdownMenuItem onClick={(e) => {
                    e.stopPropagation();
                    onRestore?.();
                  }}>
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Restore
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete?.();
                    }}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete permanently
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    );
  }
};

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return bytes + " B";
  else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
  else if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + " MB";
  else return (bytes / 1073741824).toFixed(1) + " GB";
};

const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
  }).format(date);
};

export default FileItem;

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
import React, { useState } from "react";

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
  const { token, user } = useAuth();
  const [isDownloading, setIsDownloading] = useState(false);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [thumbnailError, setThumbnailError] = useState(false);

  // Load thumbnail for images if in grid view
  React.useEffect(() => {
    if (
      viewMode === "grid" &&
      file.type.startsWith("image/") &&
      token &&
      user
    ) {
      const loadThumbnail = async () => {
        try {
          const url = await filesApi.getCachedFileUrl(token, file._id, user.id);
          setThumbnailUrl(url);
        } catch (error) {
          console.error("Error loading thumbnail:", error);
          setThumbnailError(true);
        }
      };

      loadThumbnail();
    }
  }, [file._id, file.type, token, user?.id, viewMode]);

  const handleFileClick = () => {
    onClick();
  };

  const handleStar = (e: React.MouseEvent) => {
    e.stopPropagation();
    onStar?.();
  };

  const handleTrash = (e: React.MouseEvent) => {
    e.stopPropagation();
    onTrash?.();
  };

  const handleRestore = (e: React.MouseEvent) => {
    e.stopPropagation();
    onRestore?.();
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete?.();
  };

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!token || !user) return;

    setIsDownloading(true);
    try {
      const blob = await filesApi.downloadFile(token, file._id, user.id);
      const url = URL.createObjectURL(blob);
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

  // Get file icon based on file type
  const getFileIcon = () => {
    // For grid view thumbnails
    if (viewMode === "grid") {
      if (file.type.startsWith("image/")) {
        if (thumbnailUrl && !thumbnailError) {
          return (
            <div className="mb-2 flex h-24 w-24 items-center justify-center rounded-md bg-muted overflow-hidden">
              <img
                src={thumbnailUrl}
                alt={file.name}
                className="h-full w-full object-cover"
                onError={() => setThumbnailError(true)}
              />
            </div>
          );
        } else {
          return (
            <div className="mb-2 flex h-24 w-24 items-center justify-center rounded-md bg-muted">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-12 w-12 text-muted-foreground"
              >
                <rect width="18" height="18" x="3" y="3" rx="2" ry="2"></rect>
                <circle cx="9" cy="9" r="2"></circle>
                <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"></path>
              </svg>
            </div>
          );
        }
      } else if (file.type.startsWith("video/")) {
        return (
          <div className="mb-2 flex h-24 w-24 items-center justify-center rounded-md bg-muted">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-12 w-12 text-muted-foreground"
            >
              <path d="m10 7 5 3-5 3Z"></path>
              <rect width="20" height="14" x="2" y="3" rx="2"></rect>
              <path d="M12 17v4"></path>
              <path d="M8 21h8"></path>
            </svg>
          </div>
        );
      } else if (file.type.startsWith("audio/")) {
        return (
          <div className="mb-2 flex h-24 w-24 items-center justify-center rounded-md bg-muted">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-12 w-12 text-muted-foreground"
            >
              <path d="M2 13a2 2 0 0 0 2 2h3a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"></path>
              <path d="M14 13a2 2 0 0 0 2 2h3a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2h-3a2 2 0 0 0-2 2Z"></path>
              <path d="M10 21v-6"></path>
              <path d="M7 18h6"></path>
              <path d="M19 21v-6"></path>
            </svg>
          </div>
        );
      } else {
        return (
          <div className="mb-2 flex h-24 w-24 items-center justify-center rounded-md bg-muted">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-12 w-12 text-muted-foreground"
            >
              <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
            </svg>
          </div>
        );
      }
    } else {
      // For list view icons - smaller and more compact
      if (file.type.startsWith("image/")) {
        if (thumbnailUrl && !thumbnailError) {
          return (
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted overflow-hidden">
              <img
                src={thumbnailUrl}
                alt={file.name}
                className="h-full w-full object-cover"
                onError={() => setThumbnailError(true)}
              />
            </div>
          );
        } else {
          return (
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-5 w-5 text-muted-foreground"
              >
                <rect width="18" height="18" x="3" y="3" rx="2" ry="2"></rect>
                <circle cx="9" cy="9" r="2"></circle>
                <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"></path>
              </svg>
            </div>
          );
        }
      } else if (file.type.startsWith("video/")) {
        return (
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5 text-muted-foreground"
            >
              <path d="m10 7 5 3-5 3Z"></path>
              <rect width="20" height="14" x="2" y="3" rx="2"></rect>
              <path d="M12 17v4"></path>
              <path d="M8 21h8"></path>
            </svg>
          </div>
        );
      } else if (file.type.startsWith("audio/")) {
        return (
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5 text-muted-foreground"
            >
              <path d="M2 13a2 2 0 0 0 2 2h3a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"></path>
              <path d="M14 13a2 2 0 0 0 2 2h3a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2h-3a2 2 0 0 0-2 2Z"></path>
              <path d="M10 21v-6"></path>
              <path d="M7 18h6"></path>
              <path d="M19 21v-6"></path>
            </svg>
          </div>
        );
      } else {
        return (
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5 text-muted-foreground"
            >
              <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
            </svg>
          </div>
        );
      }
    }
  };

  // For grid view
  if (viewMode === "grid") {
    return (
      <div
        className="group relative flex aspect-square h-full w-full cursor-pointer flex-col items-center justify-center rounded-md border p-4 hover:bg-secondary"
        onClick={handleFileClick}
      >
        {file.isStarred && (
          <div className="absolute left-2 top-2 z-10">
            <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
          </div>
        )}

        <div className="absolute right-2 top-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Open menu</span>
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[160px]">
              <DropdownMenuItem
                onClick={handleDownload}
                disabled={isDownloading}
              >
                <Download className="mr-2 h-4 w-4" />
                Download
              </DropdownMenuItem>
              {onStar && (
                <DropdownMenuItem onClick={handleStar}>
                  <Star className="mr-2 h-4 w-4" />
                  {file.isStarred ? "Unstar" : "Star"}
                </DropdownMenuItem>
              )}
              {onTrash && (
                <DropdownMenuItem onClick={handleTrash}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Move to Trash
                </DropdownMenuItem>
              )}
              {onRestore && (
                <DropdownMenuItem onClick={handleRestore}>
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Restore
                </DropdownMenuItem>
              )}
              {onDelete && (
                <DropdownMenuItem onClick={handleDelete}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {getFileIcon()}
        <p className="text-sm font-medium line-clamp-1 text-center break-all">
          {file.name}
        </p>
        <p className="text-xs text-muted-foreground">
          {formatFileSize(file.size)}
        </p>
      </div>
    );
  }

  // For list view
  return (
    <div
      className="w-full flex items-center cursor-pointer"
      onClick={handleFileClick}
    >
      <div className="flex items-center flex-1">
        <div className="mr-3">{getFileIcon()}</div>
        <div className="flex flex-col min-w-0">
          <div className="flex items-center">
            <p className="text-sm font-medium truncate pr-2 max-w-[350px]">
              {file.name}
            </p>
            {file.isStarred && (
              <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400 shrink-0" />
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {file.type.split("/")[1]?.toUpperCase() || file.type}
          </p>
        </div>
      </div>

      <div className="flex items-center ml-auto">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full p-0 ml-2"
            >
              <MoreVertical className="h-4 w-4" />
              <span className="sr-only">Actions</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[160px]">
            <DropdownMenuItem onClick={handleDownload} disabled={isDownloading}>
              <Download className="mr-2 h-4 w-4" />
              Download
            </DropdownMenuItem>
            {onStar && (
              <DropdownMenuItem onClick={handleStar}>
                <Star className="mr-2 h-4 w-4" />
                {file.isStarred ? "Unstar" : "Star"}
              </DropdownMenuItem>
            )}
            {onTrash && (
              <DropdownMenuItem onClick={handleTrash}>
                <Trash2 className="mr-2 h-4 w-4" />
                Move to Trash
              </DropdownMenuItem>
            )}
            {onRestore && (
              <DropdownMenuItem onClick={handleRestore}>
                <RotateCcw className="mr-2 h-4 w-4" />
                Restore
              </DropdownMenuItem>
            )}
            {onDelete && (
              <DropdownMenuItem onClick={handleDelete}>
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
};

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return bytes + " B";
  else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
  else if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + " MB";
  else return (bytes / 1073741824).toFixed(1) + " GB";
};

export default FileItem;

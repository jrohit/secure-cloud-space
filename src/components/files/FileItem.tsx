
import React, { useState } from 'react';
import { File } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { filesApi } from '@/services/api';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { MoreHorizontal, Download, Star, Trash2, RotateCcw } from "lucide-react"
import { useNavigate } from 'react-router-dom';

interface FileItemProps {
  file: File;
  onClick: () => void;
  onDelete?: () => void;
  onStar?: () => void;
  onTrash?: () => void;
  onRestore?: () => void;
  viewMode: 'grid' | 'list';
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
  const navigate = useNavigate();

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

  // Get file icon based on file type
  const getFileIcon = () => {
    if (file.type.startsWith("image/")) {
      return (
        <img
          src={filesApi.getFilePreviewUrl(token, file._id)}
          alt={file.name}
          className={viewMode === 'grid' ? "h-24 w-24 rounded-md object-cover object-center" : "h-8 w-8 rounded-md object-cover object-center"}
        />
      );
    } else if (file.type.startsWith("video/")) {
      return (
        <div className={viewMode === 'grid' ? "mb-2 flex h-24 w-24 items-center justify-center rounded-md bg-muted" : "flex h-8 w-8 items-center justify-center rounded-md bg-muted"}>
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={viewMode === 'grid' ? "h-12 w-12 text-muted-foreground" : "h-4 w-4 text-muted-foreground"}>
            <path d="M18 7c0-1.1-.9-2-2-2H6L4 7h14Z"></path>
            <path d="M18 9v9c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V9"></path>
            <path d="m10 14-4-2v4l4-2Z"></path>
            <path d="M10 14v-4"></path>
            <path d="M13 12v-2"></path>
            <path d="M13 15v-1"></path>
          </svg>
        </div>
      );
    } else if (file.type.startsWith("audio/")) {
      return (
        <div className={viewMode === 'grid' ? "mb-2 flex h-24 w-24 items-center justify-center rounded-md bg-muted" : "flex h-8 w-8 items-center justify-center rounded-md bg-muted"}>
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={viewMode === 'grid' ? "h-12 w-12 text-muted-foreground" : "h-4 w-4 text-muted-foreground"}>
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
        <div className={viewMode === 'grid' ? "mb-2 flex h-24 w-24 items-center justify-center rounded-md bg-muted" : "flex h-8 w-8 items-center justify-center rounded-md bg-muted"}>
          <Download className={viewMode === 'grid' ? "h-12 w-12 text-muted-foreground" : "h-4 w-4 text-muted-foreground"} />
        </div>
      );
    }
  };

  const renderGridItem = () => (
    <div
      className="relative group flex aspect-square h-full w-full cursor-pointer flex-col items-center justify-center rounded-md border p-4 hover:bg-secondary"
      onClick={handleFileClick}
    >
      <div className="absolute right-2 top-2 z-10 hidden group-hover:block">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">Open menu</span>
              <MoreHorizontal className="h-4 w-4" />
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
      {getFileIcon()}
      <p className="text-sm font-medium line-clamp-1">{file.name}</p>
      <p className="text-xs text-muted-foreground">
        {formatFileSize(file.size)}
      </p>
    </div>
  );

  const renderListItem = () => (
    <div
      className="group relative flex items-center justify-between space-x-2 rounded-md border p-4 hover:bg-secondary"
      onClick={handleFileClick}
    >
      <div className="flex items-center space-x-4">
        {getFileIcon()}
        <div>
          <p className="text-sm font-medium line-clamp-1">{file.name}</p>
          <p className="text-xs text-muted-foreground">
            {file.type} · {formatFileSize(file.size)}
          </p>
        </div>
      </div>
      <div className="absolute right-2 top-2 z-10 hidden group-hover:block">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">Open menu</span>
              <MoreHorizontal className="h-4 w-4" />
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

  return viewMode === 'grid' ? renderGridItem() : renderListItem();
};

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return bytes + " B";
  else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
  else if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + " MB";
  else return (bytes / 1073741824).toFixed(1) + " GB";
};

export default FileItem;

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
import { DotsHorizontalIcon, Download, Star, Trash2, RotateCcw } from "lucide-react"
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
              <DotsHorizontalIcon className="h-4 w-4" />
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
      {file.type.startsWith("image/") ? (
        <img
          src={filesApi.getFilePreviewUrl(token, file._id)}
          alt={file.name}
          className="h-24 w-24 rounded-md object-cover object-center"
        />
      ) : (
        <div className="mb-2 flex h-24 w-24 items-center justify-center rounded-md bg-muted">
          <Download className="h-12 w-12 text-muted-foreground" />
        </div>
      )}
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
        {file.type.startsWith("image/") ? (
          <img
            src={filesApi.getFilePreviewUrl(token, file._id)}
            alt={file.name}
            className="h-8 w-8 rounded-md object-cover object-center"
          />
        ) : (
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted">
            <Download className="h-4 w-4 text-muted-foreground" />
          </div>
        )}
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
              <DotsHorizontalIcon className="h-4 w-4" />
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

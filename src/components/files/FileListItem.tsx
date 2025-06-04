import * as React from 'react';
import { MyFileType } from '@/types';
import { formatDistanceToNow } from 'date-fns';
import { File as FileIconLucide, Image, FileText, Star, MoreVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  ContextMenu,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import ItemContextMenu from './ItemContextMenu'; // Assuming ItemContextMenu is in the same folder

// Helper to format file size (consider moving to a utils file if used elsewhere)
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
  else if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + " MB";
  else return (bytes / 1073741824).toFixed(1) + " GB";
}

// Helper to get appropriate file icon (similar to FileItem)
function getFileIcon(type: string): React.ElementType {
  if (type.startsWith("image/")) return Image;
  if (type.includes("pdf")) return FileText; // Or a specific PDF icon if available
  if (type.includes("document") || type.includes("text")) return FileText;
  return FileIconLucide;
}

interface FileListItemProps {
  file: MyFileType;
  onPreview: (file: MyFileType) => void;
  onStarToggle: (fileId: string, newIsStarred: boolean) => void;
  onRename: (id: string, type: 'file' | 'folder', currentName: string) => void;
  onOrganize: (id: string, type: 'file' | 'folder', currentParentId: string | null) => void;
  onDelete: (id: string, type: 'file' | 'folder') => void;
  currentParentId: string | null;
}

const FileListItem: React.FC<FileListItemProps> = ({
  file,
  onPreview,
  onStarToggle,
  onRename,
  onOrganize,
  onDelete,
  currentParentId,
}) => {
  const FileDisplayIcon = getFileIcon(file.type);

  return (
    <ContextMenu>
      <ContextMenuTrigger>
        <div
          className="flex items-center w-full p-2 hover:bg-muted/50 rounded-md cursor-pointer border-b border-border/60"
          onClick={() => onPreview(file)} // Main click action for preview
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onPreview(file); }}
        >
          <FileDisplayIcon className="h-6 w-6 mr-3 text-muted-foreground flex-shrink-0" />
          <span className="text-sm font-medium truncate flex-grow min-w-0" title={file.name}>
            {file.name}
          </span>
          <span className="text-xs text-muted-foreground mx-4 hidden sm:block flex-shrink-0">
            {formatFileSize(file.size)}
          </span>
          {/* Added console.log for debugging updatedAt */}
          <span className="text-xs text-muted-foreground mr-4 hidden md:block flex-shrink-0">
            Modified {console.log('FileListItem updatedAt:', file.updatedAt, 'typeof:', typeof file.updatedAt)}
            {file.updatedAt ? formatDistanceToNow(new Date(file.updatedAt), { addSuffix: true }) : 'Unknown date'}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className={cn("h-8 w-8 mr-1 flex-shrink-0", file.isStarred ? "text-yellow-400 hover:text-yellow-500" : "text-muted-foreground hover:text-yellow-400")}
            onClick={(e) => {
              e.stopPropagation(); // Prevent row click when starring
              onStarToggle(file._id, !file.isStarred);
            }}
            aria-label={file.isStarred ? "Unstar file" : "Star file"}
          >
            <Star className={cn("h-5 w-5", file.isStarred && "fill-yellow-400")} />
          </Button>
          {/*
            For a cleaner list view, the "MoreVertical" button for dropdown menu
            is often part of the ContextMenu itself or handled by right-click.
            If an explicit button is needed, it can be added here, ensuring stopPropagation.
            For now, relying on ContextMenuTrigger for right-click.
          */}
        </div>
      </ContextMenuTrigger>
      <ItemContextMenu
        itemType="file"
        itemId={file._id}
        itemName={file.name}
        currentParentId={currentParentId}
        onDelete={onDelete}
        onRename={onRename}
        onOrganize={onOrganize}
      />
    </ContextMenu>
  );
};

export default FileListItem;

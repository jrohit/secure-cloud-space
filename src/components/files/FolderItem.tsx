import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import ItemContextMenu from "./ItemContextMenu"; // Import ItemContextMenu
import { Folder } from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { formatDistanceToNow } from "date-fns";
import { FolderOpen, Trash2, MoreVertical } from "lucide-react";

interface FolderItemProps {
  folder: Folder;
  onClick: () => void;
  onDelete: () => void;
  onRename: (id: string, type: 'file' | 'folder', currentName: string) => void;
  onOrganize: (id: string, type: 'file' | 'folder', currentParentId: string | null) => void; // Modified
  currentParentId: string | null; // Added
}

const FolderItem: React.FC<FolderItemProps> = ({ folder, onClick, onDelete, onRename, onOrganize, currentParentId }) => {
  return (
    <ContextMenu>
      <ContextMenuTrigger>
        <Card
          className="w-[16rem] h-[12] rounded-lg overflow-hidden transition-all duration-200 hover:shadow-md cursor-pointer flex" // Height MODIFIED, flex properties adjusted
          onClick={(e) => {
        // Don't navigate if clicking on the dropdown
        if ((e.target as HTMLElement).closest('.dropdown-menu-trigger')) {
          e.stopPropagation();
          return;
        }
        onClick();
      }}
    >
      <CardContent className="flex items-center p-3 space-x-3 w-full"> {/* Ensure CardContent takes full width and apply padding/spacing */}
        <FolderOpen className="h-6 w-6 text-[var(--folder-icon-color)] flex-shrink-0" />
        <div className="flex flex-col truncate min-w-0"> {/* Allow text container to shrink and truncate */}
          <span className="text-sm font-medium truncate" title={folder.name}>
            {folder.name}
          </span>
          {/* Console log for debugging, kept as requested */}
          {console.log('FolderItem updatedAt:', folder.updatedAt, 'typeof:', typeof folder.updatedAt)}
          <span className="text-xs text-muted-foreground truncate">
            {folder.updatedAt ? formatDistanceToNow(new Date(folder.updatedAt), { addSuffix: true }) : 'Unknown date'}
          </span>
        </div>
      </CardContent>
        </Card>
      </ContextMenuTrigger>
      <ItemContextMenu
        itemType="folder"
        itemId={folder._id}
        itemName={folder.name}
        currentParentId={currentParentId} // Added
        onDelete={() => onDelete()} // Call the FolderItem's onDelete
        onRename={onRename} // Pass down from FileGrid
        onOrganize={onOrganize} // Pass down from FileGrid
      />
    </ContextMenu>
  );
};

export default FolderItem;

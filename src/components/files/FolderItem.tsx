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
          className="w-[16rem] h-[10rem] rounded-lg overflow-hidden transition-all duration-200 hover:shadow-md cursor-pointer flex flex-col justify-between"
          onClick={(e) => {
        // Don't navigate if clicking on the dropdown
        if ((e.target as HTMLElement).closest('.dropdown-menu-trigger')) {
          e.stopPropagation();
          return;
        }
        onClick();
      }}
    >
      {/* Adjusted CardContent and CardFooter for better layout within fixed height */}
      <CardContent className="p-4 flex-grow flex items-center justify-center">
        {/* Removed aspect-square to allow icon to size more freely within the content area */}
        <div className="flex items-center justify-center bg-muted/20 p-2 rounded-md">
          <FolderOpen className="h-16 w-16 sm:h-20 sm:w-20 text-cloudDrive-blue opacity-80" />
        </div>
      </CardContent>
      <CardFooter className="p-3 pt-0 flex-col items-start gap-1 border-t bg-background/50">
        <div className="w-full flex justify-between items-center"> {/* items-center for better vertical alignment of name and menu */}
          <div className="truncate flex-1">
            <h3 className="text-sm font-semibold truncate" title={folder.name}>
              {folder.name}
            </h3>
          </div>
          {/* The DropdownMenu from original code for other actions (like direct delete) is removed
              as all actions are now meant to be in ItemContextMenu triggered by right-click.
              If a visible ellipsis for non-context menu actions is still desired, it would be re-added here.
              For this task, we assume ItemContextMenu is the primary action source.
          */}
        </div>
        {/* Added console.log for debugging updatedAt */}
        <p className="text-xs text-muted-foreground w-full truncate"> {/* Ensure date also truncates if needed */}
          Modified {console.log('FolderItem updatedAt:', folder.updatedAt, 'typeof:', typeof folder.updatedAt)}
          {folder.updatedAt ? formatDistanceToNow(new Date(folder.updatedAt), { addSuffix: true }) : 'Unknown date'}
        </p>
      </CardFooter>
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

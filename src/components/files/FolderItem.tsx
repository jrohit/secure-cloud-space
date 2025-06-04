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
          className="w-[16rem] h-[1rem] rounded-lg overflow-hidden transition-all duration-200 hover:shadow-md cursor-pointer flex items-center justify-center" // Adjusted flex properties
          onClick={(e) => {
        // Don't navigate if clicking on the dropdown
        if ((e.target as HTMLElement).closest('.dropdown-menu-trigger')) {
          e.stopPropagation();
          return;
        }
        onClick();
      }}
    >
      {/* Content is removed/simplified due to h-[1rem].
          A tiny piece of text might be visible if desired, but overflow-hidden will clip most.
          For instance, we could try to show a very truncated name, but it's not the primary goal.
          The console.log is kept for debugging date issues if they were ever related to this component,
          though visually it won't matter much now.
      */}
      <CardContent className="p-0 m-0 w-full text-center">
        {/* <span className="text-[0.5rem] truncate">{folder.name}</span> */}
        {console.log('FolderItem updatedAt:', folder.updatedAt, 'typeof:', typeof folder.updatedAt)}
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

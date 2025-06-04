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
          className="w-[16rem] h-[10rem] rounded-lg overflow-hidden transition-all duration-200 hover:shadow-md cursor-pointer flex flex-col"
          onClick={(e) => {
        // Don't navigate if clicking on the dropdown
        if ((e.target as HTMLElement).closest('.dropdown-menu-trigger')) {
          e.stopPropagation();
          return;
        }
        onClick();
      }}
    >
      <CardContent className="p-4 flex flex-col flex-grow justify-start"> {/* Changed padding, flex-grow, and alignment */}
        {/* Folder Icon - smaller and to the side of the name now */}
        <div className="flex items-start mb-3">
          <FolderOpen className="h-8 w-8 text-[var(--folder-icon-color)] opacity-90 mr-3 flex-shrink-0 mt-1" /> {/* MODIFIED */}
          <div className="flex-grow min-w-0"> {/* Ensure this div can shrink and name truncates */}
            <h3 className="text-lg font-semibold truncate" title={folder.name}> {/* Increased font size */}
              {folder.name}
            </h3>
          </div>
        </div>

        {/* Spacer to push date to the bottom of CardContent if CardContent is set to flex-grow and flex-col */}
        <div className="flex-grow"></div>

        {/* Added console.log for debugging updatedAt */}
        <p className="text-xs text-muted-foreground w-full truncate">
          Modified {console.log('FolderItem updatedAt:', folder.updatedAt, 'typeof:', typeof folder.updatedAt)}
          {folder.updatedAt ? formatDistanceToNow(new Date(folder.updatedAt), { addSuffix: true }) : 'Unknown date'}
        </p>
      </CardContent>
      {/* CardFooter is removed as its content is moved to CardContent */}
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

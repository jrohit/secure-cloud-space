import * as React from "react";
import { Folder } from "@/types";
import { formatDistanceToNow } from "date-fns";
import { Folder as FolderIconLucide, MoreVertical } from "lucide-react";
// import { Button } from '@/components/ui/button'; // Only if explicit more button needed
import { ContextMenu, ContextMenuTrigger } from "@/components/ui/context-menu";
import ItemContextMenu from "./ItemContextMenu";

interface FolderListItemProps {
  folder: Folder;
  onClick: () => void; // For navigating into the folder
  onRename: (id: string, type: "file" | "folder", currentName: string) => void;
  onOrganize: (
    id: string,
    type: "file" | "folder",
    currentParentId: string | null,
  ) => void;
  onDelete: (id: string, type: "file" | "folder") => void;
  currentParentId: string | null;
}

const FolderListItem: React.FC<FolderListItemProps> = ({
  folder,
  onClick,
  onRename,
  onOrganize,
  onDelete,
  currentParentId,
}) => {
  return (
    <ContextMenu>
      <ContextMenuTrigger>
        <div
          className="flex items-center w-full p-2 hover:bg-muted/50 rounded-md cursor-pointer border-b border-border/60"
          onClick={onClick} // Main click action for navigation
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") onClick();
          }}
        >
          <FolderIconLucide className="h-6 w-6 mr-3 text-[var(--folder-icon-color)] flex-shrink-0" />{" "}
          {/* MODIFIED */}
          <span
            className="text-sm font-medium truncate flex-grow min-w-0"
            title={folder.name}
          >
            {folder.name}
          </span>
          {/* Added console.log for debugging updatedAt */}
          <span className="text-xs text-muted-foreground mr-4 hidden md:block flex-shrink-0">
            Modified{" "}
            {console.log(
              "FolderListItem updatedAt:",
              folder.updatedAt,
              "typeof:",
              typeof folder.updatedAt,
            )}
            {folder.updatedAt
              ? formatDistanceToNow(new Date(folder.updatedAt), {
                  addSuffix: true,
                })
              : "Unknown date"}
          </span>
          {/*
            Similar to FileListItem, actions like star (if applicable to folders later)
            or an explicit "More" button would be placed here.
            For now, relying on ContextMenuTrigger for right-click.
          */}
        </div>
      </ContextMenuTrigger>
      <ItemContextMenu
        itemType="folder"
        itemId={folder._id}
        itemName={folder.name}
        currentParentId={currentParentId}
        onDelete={onDelete}
        onRename={onRename}
        onOrganize={onOrganize}
      />
    </ContextMenu>
  );
};

export default FolderListItem;

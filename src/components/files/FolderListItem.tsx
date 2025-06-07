import * as React from "react";
import { Folder } from "@/types";
import { formatDistanceToNow } from "date-fns";
import { Folder as FolderIconLucide, MoreVertical } from "lucide-react";
// import { Button } from '@/components/ui/button'; // Only if explicit more button needed
import { ContextMenu, ContextMenuTrigger } from "@/components/ui/context-menu";
import ItemContextMenu from "./ItemContextMenu";
import { cn } from "@/lib/utils"; // Added cn import

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
  selectedItems: Set<string>;
  onItemSelect: (itemId: string) => void;
  style?: React.CSSProperties; // Added for react-window
}

const FolderListItem: React.FC<FolderListItemProps> = ({
  folder,
  onClick,
  onRename,
  onOrganize,
  onDelete,
  currentParentId,
  selectedItems,
  onItemSelect,
  style, // Added for react-window
}) => {
  const isSelected = selectedItems.has(folder._id);
  return (
    <ContextMenu>
      <ContextMenuTrigger>
        <div
          style={style} // Apply style for react-window
          className={cn(
            "flex items-center w-full p-2 hover:bg-muted/50 rounded-md cursor-pointer border-b border-border/60",
            { "bg-blue-100 dark:bg-blue-900": isSelected }
          )}
          onClick={() => onItemSelect(folder._id)} // Single click selects
          onDoubleClick={onClick} // Double click navigates (uses the original onClick prop)
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              // For accessibility, Enter/Space on a focused item usually performs the primary action (double click)
              onClick(); // Original navigation action
            }
          }}
        >
          <FolderIconLucide
            className={cn(
              "h-6 w-6 mr-3 text-[var(--folder-icon-color)] flex-shrink-0",
              { "text-white dark:text-black": isSelected } // Example: Adjust icon color if selected
            )}
          />{" "}
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

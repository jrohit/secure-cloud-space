import { Card, CardContent } from "@/components/ui/card";
import { ContextMenu, ContextMenuTrigger } from "@/components/ui/context-menu";
import { Folder } from "@/types";
import { formatDistanceToNow } from "date-fns";
import { FolderOpen } from "lucide-react";
import ItemContextMenu from "./ItemContextMenu"; // Import ItemContextMenu
import { cn } from "@/lib/utils"; // Added cn import

interface FolderItemProps {
  folder: Folder;
  onClick: () => void;
  onDelete: () => void;
  onRename: (id: string, type: "file" | "folder", currentName: string) => void;
  onOrganize: (
    id: string,
    type: "file" | "folder",
    currentParentId: string | null
  ) => void; // Modified
  onDownloadFile: (
    fileId: string,
    fileName: string,
    originalFileType: string
  ) => void;
  currentParentId: string | null;
  selectedItems: Set<string>;
  onItemSelect: (itemId: string) => void;
}

const FolderItem: React.FC<FolderItemProps> = ({
  folder,
  onClick,
  onDelete,
  onRename,
  onOrganize,
  currentParentId,
  selectedItems,
  onItemSelect,
}) => {
  const isSelected = selectedItems.has(folder._id);
  return (
    <ContextMenu>
      <ContextMenuTrigger>
        <Card
          className={cn(
            "w-[16rem] h-[12] rounded-lg overflow-hidden transition-all duration-200 hover:shadow-md cursor-pointer flex", // Height MODIFIED, flex properties adjusted
            { "ring-2 ring-blue-500 dark:ring-blue-700": isSelected }
          )}
          onClick={(e) => {
            // Prevent action if clicking on a dropdown trigger within the card (if any were added)
            if ((e.target as HTMLElement).closest(".dropdown-menu-trigger")) {
              e.stopPropagation();
              return;
            }
            onItemSelect(folder._id); // Single click selects
          }}
          onDoubleClick={(e) => {
            // Prevent action if clicking on a dropdown trigger
            if ((e.target as HTMLElement).closest(".dropdown-menu-trigger")) {
              e.stopPropagation();
              return;
            }
            onClick(); // Double click navigates
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              // For accessibility, Enter/Space on a focused item usually performs the primary action (double click)
              // Prevent action if clicking on a dropdown trigger
              if ((e.target as HTMLElement).closest(".dropdown-menu-trigger")) {
                e.stopPropagation();
                return;
              }
              onClick(); // Original navigation action
            }
          }}
          role="button" // Added for accessibility
          tabIndex={0} // Added for accessibility
        >
          <CardContent className="flex items-center p-3 space-x-3 w-full">
            {" "}
            {/* Ensure CardContent takes full width and apply padding/spacing */}
            <FolderOpen
              className={cn(
                "h-6 w-6 text-[var(--folder-icon-color)] flex-shrink-0",
                { "text-white dark:text-black": isSelected }
              )}
            />
            <div className="flex flex-col truncate min-w-0">
              {" "}
              {/* Allow text container to shrink and truncate */}
              <span
                className={cn("text-sm font-medium truncate", {
                  "text-white dark:text-black": isSelected,
                })}
                title={folder.name}
              >
                {folder.name}
              </span>
              <span
                className={cn("text-xs text-muted-foreground truncate", {
                  "text-blue-200 dark:text-blue-300": isSelected,
                })}
              >
                {folder.updatedAt
                  ? formatDistanceToNow(new Date(folder.updatedAt), {
                      addSuffix: true,
                    })
                  : "Unknown date"}
              </span>
            </div>
          </CardContent>
        </Card>
      </ContextMenuTrigger>
      <ItemContextMenu
        itemType="folder"
        itemId={folder._id}
        isSelected={isSelected} // Pass isSelected to context menu
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

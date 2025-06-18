import { MyFileType as File, Folder } from "@/types";
import FileItem from "./FileItem";
import FileListItem from "./FileListItem";
import FolderItem from "./FolderItem";
import FolderListItem from "./FolderListItem";
import { VariableSizeList } from "react-window";
import AutoSizer from "react-virtualized-auto-sizer"; // Correct import
import React, { useRef, useEffect } from "react"; // Ensure React is imported for JSX, add useRef, useEffect

// Define item types for the combined list
type ListItemType =
  | { id: string; type: "header"; data: { title: string } }
  | { id: string; type: "folder"; data: Folder }
  | { id: string; type: "file"; data: File };

const HEADER_HEIGHT = 40; // Example: Adjust as needed (e.g., text-lg font-semibold my-2 px-2)
const ITEM_HEIGHT = 52; // Example: Adjust based on p-2 padding, text size, border in list items

interface FileGridProps {
  folders: Folder[];
  files: File[];
  onFolderClick: (folder: Folder) => void;
  onFileDelete: (fileId: string) => void;
  onFolderDelete: (folderId: string) => void;
  onFilePreview: (file: File) => void;
  onStarToggle?: (fileId: string, newIsStarred: boolean) => void;
  onRenameItem: (
    id: string,
    type: "file" | "folder",
    currentName: string
  ) => void;
  onOrganizeItem: (
    id: string,
    type: "file" | "folder",
    currentParentId: string | null
  ) => void;
  onDownloadFile: (
    fileId: string,
    fileName: string,
    originalFileType: string
  ) => void;
  currentParentId: string | null;
  viewMode: "card" | "list"; // Added
  selectedItems: Set<string>; // Added for selection
  onItemSelect: (itemId: string) => void; // Added for selection
  deleteOpId?: number | null; // Added for delete operation tracking
  // Props for select all functionality
  onSelectAll: () => void;
  onClearSelection: () => void;
  areAllItemsSelected: boolean;
}

const FileGrid: React.FC<FileGridProps> = ({
  folders,
  files,
  onFolderClick,
  onFileDelete,
  onFolderDelete,
  onFilePreview,
  onStarToggle,
  onRenameItem,
  onOrganizeItem,
  onDownloadFile,
  currentParentId,
  viewMode, // Added
  selectedItems, // Added for selection
  onItemSelect, // Added for selection
  deleteOpId, // Added
  // Destructure new props for select all
  onSelectAll,
  onClearSelection,
  areAllItemsSelected,
}) => {
  const listRef = useRef<VariableSizeList | null>(null);
  const currentScrollOffsetRef = useRef<number>(0);
  const prevDeleteOpIdRef = useRef<number | null | undefined>(deleteOpId);
  const topVisibleItemIdRef = useRef<string | null>(null); // Ref for top visible item ID

  // Moved useEffect outside the conditional rendering block
  useEffect(() => {
    if (viewMode === "list") { // Added condition to run logic only for list view
      // Reconstruct listItems here since it's needed for findIndex
      const listItemsEffect: ListItemType[] = [];
      if (folders.length > 0) {
        listItemsEffect.push({
          id: "header-folders",
          type: "header",
          data: { title: "Folders" },
        });
        folders.forEach((folder) =>
          listItemsEffect.push({ id: folder._id, type: "folder", data: folder })
        );
      }
      if (files.length > 0) {
        listItemsEffect.push({
          id: "header-files",
          type: "header",
          data: { title: "Files" },
        });
        files.forEach((file) =>
          listItemsEffect.push({ id: file._id, type: "file", data: file })
        );
      }

      let timeoutId: NodeJS.Timeout | null = null;

      if (listRef.current && deleteOpId !== null && deleteOpId !== prevDeleteOpIdRef.current) {
        const listInstance = listRef.current; // Capture current instance for the closure

        timeoutId = setTimeout(() => {
          if (topVisibleItemIdRef.current) {
            const targetItemId = topVisibleItemIdRef.current;
            // Use the locally reconstructed listItemsEffect
            const newIndex = listItemsEffect.findIndex(item => item.id === targetItemId);

            if (newIndex !== -1) {
              listInstance.scrollToItem(newIndex, 'start');
            } else {
              // Fallback: Item was deleted or not found
              if (currentScrollOffsetRef.current !== undefined) {
                listInstance.scrollTo(currentScrollOffsetRef.current);
              }
            }
          } else if (currentScrollOffsetRef.current !== undefined) {
            // Fallback if no topVisibleItemId was ever set
            listInstance.scrollTo(currentScrollOffsetRef.current);
          }
        }, 50); // 50ms delay
      }

      // Always update the ref to the current deleteOpId after the effect's main logic setup
      prevDeleteOpIdRef.current = deleteOpId;

      return () => {
        // Cleanup: clear the timeout if the component unmounts or dependencies change before firing
        if (timeoutId !== null) {
          clearTimeout(timeoutId);
        }
      };
    }
    // listRef, topVisibleItemIdRef, currentScrollOffsetRef are stable refs
  }, [viewMode, deleteOpId, files, folders]); // Added files and folders to dependencies

  // Effect for handling CTRL+A or CMD+A for select all
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Check for Ctrl+A (Windows/Linux) or Cmd+A (Mac)
      if (event.key.toLowerCase() === 'a' && (event.ctrlKey || event.metaKey)) {
        event.preventDefault(); // Prevent default browser action (e.g., selecting all text on page)
        if (areAllItemsSelected) {
          onClearSelection();
        } else {
          onSelectAll();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    // Cleanup function to remove the event listener
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onSelectAll, onClearSelection, areAllItemsSelected]); // Dependencies for the effect

  if (viewMode === "list") {
    const listItems: ListItemType[] = [];

    if (folders.length > 0) {
      listItems.push({
        id: "header-folders",
        type: "header",
        data: { title: "Folders" },
      });
      folders.forEach((folder) =>
        listItems.push({ id: folder._id, type: "folder", data: folder })
      );
    }

    if (files.length > 0) {
      listItems.push({
        id: "header-files",
        type: "header",
        data: { title: "Files" },
      });
      files.forEach((file) =>
        listItems.push({ id: file._id, type: "file", data: file })
      );
    }

    const getItemSize = (index: number) =>
      listItems[index].type === "header" ? HEADER_HEIGHT : ITEM_HEIGHT;

    // Row component for VariableSizeList
    const Row = ({
      index,
      style,
    }: {
      index: number;
      style: React.CSSProperties;
    }) => {
      const item = listItems[index];
      if (item.type === "header") {
        return (
          <div style={style} className="flex items-center">
            <h2 className="text-lg font-semibold px-2 py-1">{item.data.title}</h2>
          </div>
        );
      } else if (item.type === "folder") {
        return (
          <FolderListItem
            style={style} // Pass style for react-window positioning
            folder={item.data as Folder}
            onClick={() => onFolderClick(item.data as Folder)}
            onDelete={(id) => onFolderDelete(id)}
            onRename={onRenameItem}
            onOrganize={onOrganizeItem}
            currentParentId={currentParentId}
            selectedItems={selectedItems}
            onItemSelect={onItemSelect}
          />
        );
      } else if (item.type === "file") {
        return (
          <FileListItem
            style={style} // Pass style for react-window positioning
            file={item.data as File}
            onPreview={onFilePreview}
            onStarToggle={onStarToggle!}
            onRename={onRenameItem}
            onOrganize={onOrganizeItem}
            onDelete={(id) => onFileDelete(id)}
            onDownloadFile={onDownloadFile}
            currentParentId={currentParentId}
            selectedItems={selectedItems}
            onItemSelect={onItemSelect}
          />
        );
      }
      return null;
    };

    return (
      <div className="flex-grow h-full w-full"> {/* Container for AutoSizer */}
        <AutoSizer>
          {({ height, width }) => (
            <VariableSizeList
              ref={listRef} // Assign the ref
              height={height}
              width={width}
              itemCount={listItems.length}
              itemSize={getItemSize}
              itemKey={(index) => listItems[index].id}
              className="custom-scrollbar-class" // Optional
              onScroll={({ scrollOffset }) => { // Store current scroll offset
                currentScrollOffsetRef.current = scrollOffset;
              }}
              onItemsRendered={({ visibleStartIndex }) => {
                if (listItems.length > 0 && visibleStartIndex < listItems.length) {
                  topVisibleItemIdRef.current = listItems[visibleStartIndex].id;
                } else {
                  topVisibleItemIdRef.current = null; // Reset if list is empty or index out of bounds
                }
              }}
            >
              {Row}
            </VariableSizeList>
          )}
        </AutoSizer>
      </div>
    );
  }

  // Card view (existing logic) - remains unchanged
  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 mt-2">
        {folders.length > 0 && (
          <h2 className="col-span-full text-lg font-semibold">Folders</h2>
        )}
        {folders.map((folder) => (
          <FolderItem
            key={folder._id}
            folder={folder}
            onClick={() => onFolderClick(folder)}
            onDelete={() => onFolderDelete(folder._id)} // Original onDelete for FolderItem
            onRename={onRenameItem}
            onOrganize={onOrganizeItem}
            onDownloadFile={onDownloadFile}
            currentParentId={currentParentId}
            selectedItems={selectedItems} // Pass prop
            onItemSelect={onItemSelect} // Pass prop
          />
        ))}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 mt-2">
        {files.length > 0 && (
          <h2 className="col-span-full text-lg font-semibold">Files</h2>
        )}
        {files.map((file) => (
          <FileItem
            key={file._id}
            file={file}
            onDelete={() => onFileDelete(file._id)} // Original onDelete for FileItem
            onPreview={onFilePreview}
            onStarToggle={onStarToggle}
            onRename={onRenameItem}
            onOrganize={onOrganizeItem}
            onDownloadFile={onDownloadFile}
            currentParentId={currentParentId}
            selectedItems={selectedItems} // Pass prop
            onItemSelect={onItemSelect} // Pass prop
          />
        ))}
      </div>
    </>
  );
};

export default FileGrid;

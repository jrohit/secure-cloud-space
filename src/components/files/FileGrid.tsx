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
}) => {
  const listRef = useRef<VariableSizeList | null>(null);
  const currentScrollOffsetRef = useRef<number>(0);
  const prevDeleteOpIdRef = useRef<number | null | undefined>(deleteOpId);

  if (viewMode === "list") {
    const listItems: ListItemType[] = [];

    useEffect(() => {
      if (listRef.current && deleteOpId !== null && deleteOpId !== prevDeleteOpIdRef.current) {
        // A delete operation was just signaled
        listRef.current.scrollTo(currentScrollOffsetRef.current);
      }
      // Always update the ref to the current deleteOpId after the effect runs
      prevDeleteOpIdRef.current = deleteOpId;
    }, [listItems, deleteOpId]); // listRef and currentScrollOffsetRef are stable refs

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

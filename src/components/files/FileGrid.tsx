import { File, Folder } from "@/types";
import FileItem from "./FileItem";
import FolderItem from "./FolderItem";
import FileListItem from "./FileListItem";
import FolderListItem from "./FolderListItem";
import { FixedSizeList, FixedSizeGrid } from "react-window";
import AutoSizer from "react-virtualized-auto-sizer"; // Using AutoSizer for responsive dimensions

interface FileGridProps {
  folders: Folder[];
  files: File[];
  onFolderClick: (folder: Folder) => void;
  onFileDelete: (fileId: string) => void;
  onFolderDelete: (folderId: string) => void;
  onFilePreview: (file: File) => void;
  onStarToggle?: (fileId: string, newIsStarred: boolean) => void;
  onRenameItem: (id: string, type: 'file' | 'folder', currentName: string) => void;
  onOrganizeItem: (id: string, type: 'file' | 'folder', currentParentId: string | null) => void;
  currentParentId: string | null;
  viewMode: 'card' | 'list';
  // Thumbnail related props
  thumbnailCache: Map<string, string>;
  requestDecryptedFileForThumbnail: (
    fileId: string,
    callback: (args: { fileId: string; buffer?: ArrayBuffer; error?: string }) => void
  ) => Promise<void>;
  onThumbnailGenerated: (fileId: string, thumbnailUrl: string) => void;
}

type CombinedItem = (
  | { type: 'folder'; data: Folder; id: string }
  | { type: 'file'; data: File; id: string }
  | { type: 'header'; label: string; id: string }
);


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
  currentParentId,
  viewMode,
  // Thumbnail related props
  thumbnailCache,
  requestDecryptedFileForThumbnail,
  onThumbnailGenerated,
}) => {
  const combinedItems: CombinedItem[] = [];
  if (folders.length > 0) {
    combinedItems.push({ type: 'header', label: 'Folders', id: 'folder-header' });
    folders.forEach(folder => combinedItems.push({ type: 'folder', data: folder, id: folder._id }));
  }
  if (files.length > 0) {
    combinedItems.push({ type: 'header', label: 'Files', id: 'file-header' });
    files.forEach(file => combinedItems.push({ type: 'file', data: file, id: file._id }));
  }

  if (viewMode === 'list') {
    const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => {
      const item = combinedItems[index];
      if (item.type === 'header') {
        return <h2 className="text-lg font-semibold my-2 px-2" style={style}>{item.label}</h2>;
      } else if (item.type === 'folder') {
        return (
          <div style={style}>
            <FolderListItem
              folder={item.data as Folder}
              onClick={() => onFolderClick(item.data as Folder)}
              onDelete={(id) => onFolderDelete(id)}
              onRename={onRenameItem}
              onOrganize={onOrganizeItem}
              currentParentId={currentParentId}
            />
          </div>
        );
      } else { // type === 'file'
        const file = item.data as File;
        return (
          <div style={style}>
            <FileListItem
              file={file}
              onPreview={onFilePreview}
              onStarToggle={onStarToggle!}
              onRename={onRenameItem}
              onOrganize={onOrganizeItem}
              onDelete={(id) => onFileDelete(id)}
              currentParentId={currentParentId}
              // Thumbnail props (if FileListItem supports them)
              thumbnailUrl={thumbnailCache.get(file._id)}
              requestDecryptedFileForThumbnail={requestDecryptedFileForThumbnail}
              onThumbnailGenerated={onThumbnailGenerated}
            />
          </div>
        );
      }
    };

    return (
      <div className="h-[calc(100vh-200px)]"> {/* Adjust height as needed for toolbar/etc. */}
        <AutoSizer>
          {({ height, width }) => (
            <FixedSizeList
              height={height}
              width={width}
              itemCount={combinedItems.length}
              itemSize={50} // Adjust based on typical FileListItem/FolderListItem height
            >
              {Row}
            </FixedSizeList>
          )}
        </AutoSizer>
      </div>
    );
  }

  // Card view (FixedSizeGrid)
  // This requires more complex calculations for columnCount, rowCount, itemWidth, itemHeight
  // For simplicity in this step, we'll make some assumptions.
  // A more robust solution would calculate these dynamically.
  const CARD_WIDTH = 200; // Approximate width of a FileItem/FolderItem card
  const CARD_HEIGHT = 180; // Approximate height of a FileItem/FolderItem card
  const GAP = 16; // gap-4

  const itemsWithoutHeaders = combinedItems.filter(item => item.type !== 'header');
  const folderItems = itemsWithoutHeaders.filter(item => item.type === 'folder');
  const fileItems = itemsWithoutHeaders.filter(item => item.type === 'file');

  // We'll render folders then files. Headers will be outside the grid or handled differently.
  // This simplified example will just list all items in the grid.
  // A truly sectioned grid with headers inside react-window is much more complex.

  const Cell = ({ columnIndex, rowIndex, style }: { columnIndex: number, rowIndex: number, style: React.CSSProperties }) => {
    // This calculation needs to be based on the number of columns
    // For now, assuming a dynamic column count based on width
    const numCols = Math.max(1, Math.floor((window.innerWidth - GAP) / (CARD_WIDTH + GAP))); // Example dynamic calculation
    const index = rowIndex * numCols + columnIndex;

    if (index >= itemsWithoutHeaders.length) {
      return null; // Outside the bounds of actual items
    }
    const item = itemsWithoutHeaders[index];

    return (
      <div style={{ ...style, padding: `${GAP / 2}px` }}> {/* Apply style and padding for gap */}
        {item.type === 'folder' ? (
          <FolderItem
            folder={item.data as Folder}
            onClick={() => onFolderClick(item.data as Folder)}
            onDelete={() => onFolderDelete((item.data as Folder)._id)}
            onRename={onRenameItem}
            onOrganize={onOrganizeItem}
            currentParentId={currentParentId}
          />
        ) : ( // type === 'file'
          <FileItem
            file={item.data as File}
            onDelete={() => onFileDelete((item.data as File)._id)}
            onPreview={onFilePreview}
            onStarToggle={onStarToggle}
            onRename={onRenameItem}
            onOrganize={onOrganizeItem}
            currentParentId={currentParentId}
            // Thumbnail props
            thumbnailUrl={thumbnailCache.get((item.data as File)._id)}
            requestDecryptedFileForThumbnail={requestDecryptedFileForThumbnail}
            onThumbnailGenerated={onThumbnailGenerated}
          />
        )}
      </div>
    );
  };

  return (
    <div className="h-[calc(100vh-200px)]"> {/* Adjust height */}
      {/* Headers could be rendered outside the virtualized grid if needed */}
      {folders.length > 0 && <h2 className="text-lg font-semibold my-2 px-2">Folders</h2>}
      {/* The grid will contain only folder items if we were to split them, or handle mixed content */}

      {files.length > 0 && folders.length > 0 && <div className="my-2"></div>} {/* Spacer */}

      {files.length > 0 && <h2 className="text-lg font-semibold my-2 px-2">Files</h2>}
      {/* The grid for files */}

      {/* Simplified: One grid for all items (folders then files, excluding headers from virtual list) */}
      <AutoSizer>
        {({ height, width }) => {
          const columnCount = Math.max(1, Math.floor(width / (CARD_WIDTH + GAP)));
          const rowCount = Math.ceil(itemsWithoutHeaders.length / columnCount);
          return (
            <FixedSizeGrid
              height={height - (folders.length > 0 || files.length > 0 ? 40 : 0) * ( (folders.length > 0 ? 1:0) + (files.length > 0 ? 1:0) ) } // Adjust height for headers
              width={width}
              columnCount={columnCount}
              columnWidth={CARD_WIDTH + GAP}
              rowCount={rowCount}
              rowHeight={CARD_HEIGHT + GAP}
              itemCount={itemsWithoutHeaders.length} // Not directly used by FixedSizeGrid like this, but good for reference
            >
              {Cell}
            </FixedSizeGrid>
          );
        }}
      </AutoSizer>
    </div>
  );
};

export default FileGrid;

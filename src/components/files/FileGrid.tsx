import { File, Folder } from "@/types";
import FileItem from "./FileItem";
import FolderItem from "./FolderItem";
import FileListItem from "./FileListItem"; // Added
import FolderListItem from "./FolderListItem"; // Added

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
  onDownloadFile: (fileId: string, fileName: string, originalFileType: string) => void;
  currentParentId: string | null;
  viewMode: 'card' | 'list'; // Added
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
}) => {
  if (viewMode === 'list') {
    return (
      <div className="flex flex-col">
        {folders.length > 0 && (
          <>
            <h2 className="text-lg font-semibold my-2 px-2">Folders</h2>
            {folders.map((folder) => (
              <FolderListItem
                key={folder._id}
                folder={folder}
                onClick={() => onFolderClick(folder)}
                onDelete={(id, type) => onFolderDelete(id)} // Adjusted to match ItemContextMenu's onDelete
                onRename={onRenameItem}
                onOrganize={onOrganizeItem}
                currentParentId={currentParentId}
              />
            ))}
          </>
        )}
        {files.length > 0 && (
          <>
            <h2 className="text-lg font-semibold my-2 px-2">Files</h2>
            {files.map((file) => (
              <FileListItem
                key={file._id}
                file={file}
                onPreview={onFilePreview}
                onStarToggle={onStarToggle!} // Assuming onStarToggle will be provided if needed
                onRename={onRenameItem}
                onOrganize={onOrganizeItem}
                onDelete={(id, type) => onFileDelete(id)} // Adjusted
                onDownloadFile={onDownloadFile}
                currentParentId={currentParentId}
              />
            ))}
          </>
        )}
      </div>
    );
  }

  // Card view (existing logic)
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
      {folders.length > 0 && <h2 className="col-span-full text-lg font-semibold">Folders</h2>}
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
        />
      ))}

      {files.length > 0 && <h2 className="col-span-full text-lg font-semibold">Files</h2>}
      {files.map((file) => (
        <FileItem
          key={file._id}
          file={file}
          onDelete={() => onFileDelete(file._id)} // Original onDelete for FileItem
          onPreview={onFilePreview}
          onStarToggle={onStarToggle}
          onRename={onRenameItem}
          onOrganize={onOrganizeItem}
          currentParentId={currentParentId}
        />
      ))}
    </div>
  );
};

export default FileGrid;

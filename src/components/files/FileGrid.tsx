import { File, Folder } from "@/types";
import FileItem from "./FileItem";
import FolderItem from "./FolderItem";

interface FileGridProps {
  folders: Folder[];
  files: File[];
  onFolderClick: (folder: Folder) => void;
  onFileDelete: (fileId: string) => void;
  onFolderDelete: (folderId: string) => void;
  onFilePreview: (file: File) => void;
}

const FileGrid: React.FC<FileGridProps> = ({
  folders,
  files,
  onFolderClick,
  onFileDelete,
  onFolderDelete,
  onFilePreview,
}) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
      {/* Render folders first */}
      {folders.map((folder, index) => (
        <FolderItem
          key={index}
          folder={folder}
          onClick={() => onFolderClick(folder)}
          onDelete={() => onFolderDelete(folder._id)}
        />
      ))}

      {/* Then render files */}
      {files.map((file, index) => (
        <FileItem
          key={index}
          file={file}
          onDelete={() => onFileDelete(file._id)}
          onPreview={onFilePreview}
        />
      ))}
    </div>
  );
};

export default FileGrid;

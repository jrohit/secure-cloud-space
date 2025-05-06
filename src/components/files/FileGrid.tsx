
import { File, Folder } from "@/types";
import FileItem from "./FileItem";
import FolderItem from "./FolderItem";
import { useState } from "react";
import FilePreviewDialog from "./FilePreviewDialog";

interface FileGridProps {
  folders: Folder[];
  files: File[];
  onFolderClick: (folder: Folder) => void;
  onFileDelete: (fileId: string) => void;
  onFolderDelete: (folderId: string) => void;
  onFileStar: (fileId: string) => void;
  onFileTrash: (fileId: string) => void;
  onFileRestore?: (fileId: string) => void;
  viewMode: 'grid' | 'list';
}

const FileGrid: React.FC<FileGridProps> = ({
  folders,
  files,
  onFolderClick,
  onFileDelete,
  onFolderDelete,
  onFileStar,
  onFileTrash,
  onFileRestore,
  viewMode
}) => {
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const [previewIndex, setPreviewIndex] = useState<number>(-1);

  const handlePreviewFile = (file: File) => {
    const index = files.findIndex(f => f._id === file._id);
    setPreviewIndex(index);
    setPreviewFile(file);
  };

  const handleNextFile = () => {
    if (previewIndex < files.length - 1) {
      const nextIndex = previewIndex + 1;
      setPreviewIndex(nextIndex);
      setPreviewFile(files[nextIndex]);
    }
  };

  const handlePreviousFile = () => {
    if (previewIndex > 0) {
      const prevIndex = previewIndex - 1;
      setPreviewIndex(prevIndex);
      setPreviewFile(files[prevIndex]);
    }
  };

  const closePreview = () => {
    setPreviewFile(null);
    setPreviewIndex(-1);
  };

  if (viewMode === 'list') {
    return (
      <div className="space-y-1">
        {/* Render folders first */}
        {folders.map((folder, index) => (
          <FolderItem
            key={folder._id ?? index}
            folder={folder}
            onClick={() => onFolderClick(folder)}
            onDelete={() => onFolderDelete(folder._id)}
            viewMode="list"
          />
        ))}

        {/* Then render files */}
        {files.map((file) => (
          <FileItem
            key={file._id}
            file={file}
            onClick={() => handlePreviewFile(file)}
            onDelete={() => onFileDelete(file._id)}
            onStar={() => onFileStar(file._id)}
            onTrash={() => onFileTrash(file._id)}
            onRestore={onFileRestore ? () => onFileRestore(file._id) : undefined}
            viewMode="list"
          />
        ))}

        {previewFile && (
          <FilePreviewDialog
            file={previewFile}
            onClose={closePreview}
            onNext={previewIndex < files.length - 1 ? handleNextFile : undefined}
            onPrevious={previewIndex > 0 ? handlePreviousFile : undefined}
            hasNext={previewIndex < files.length - 1}
            hasPrevious={previewIndex > 0}
          />
        )}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
      {/* Render folders first */}
      {folders.map((folder, index) => (
        <FolderItem
          key={folder._id ?? index}
          folder={folder}
          onClick={() => onFolderClick(folder)}
          onDelete={() => onFolderDelete(folder._id)}
        />
      ))}

      {/* Then render files */}
      {files.map((file) => (
        <FileItem
          key={file._id}
          file={file}
          onClick={() => handlePreviewFile(file)}
          onDelete={() => onFileDelete(file._id)}
          onStar={() => onFileStar(file._id)}
          onTrash={() => onFileTrash(file._id)}
          onRestore={onFileRestore ? () => onFileRestore(file._id) : undefined}
          viewMode="grid"
        />
      ))}

      {previewFile && (
        <FilePreviewDialog
          file={previewFile}
          onClose={closePreview}
          onNext={previewIndex < files.length - 1 ? handleNextFile : undefined}
          onPrevious={previewIndex > 0 ? handlePreviousFile : undefined}
          hasNext={previewIndex < files.length - 1}
          hasPrevious={previewIndex > 0}
        />
      )}
    </div>
  );
};

export default FileGrid;

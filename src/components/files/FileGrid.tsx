
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

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric'
    });
  };

  if (viewMode === 'list') {
    return (
      <div className="rounded-md border">
        {/* Header row */}
        <div className="grid grid-cols-12 px-4 py-3 border-b bg-muted/50">
          <div className="col-span-6 font-medium">Name</div>
          <div className="col-span-3 font-medium">Last Modified</div>
          <div className="col-span-2 font-medium">Size</div>
          <div className="col-span-1"></div>
        </div>
        
        <div className="divide-y">
          {/* Render folders first */}
          {folders.map((folder, index) => (
            <div key={folder._id ?? index} className="grid grid-cols-12 items-center px-4 py-2 hover:bg-muted/30">
              <div className="col-span-6">
                <FolderItem
                  folder={folder}
                  onClick={() => onFolderClick(folder)}
                  onDelete={() => onFolderDelete(folder._id)}
                  viewMode="list"
                />
              </div>
              <div className="col-span-3 text-sm text-muted-foreground">
                {formatDate(folder.updatedAt)}
              </div>
              <div className="col-span-2 text-sm text-muted-foreground">
                --
              </div>
              <div className="col-span-1"></div>
            </div>
          ))}

          {/* Then render files */}
          {files.map((file) => (
            <div key={file._id} className="grid grid-cols-12 items-center px-4 py-2 hover:bg-muted/30">
              <div className="col-span-6">
                <FileItem
                  file={file}
                  onClick={() => handlePreviewFile(file)}
                  onDelete={() => onFileDelete(file._id)}
                  onStar={() => onFileStar(file._id)}
                  onTrash={() => onFileTrash(file._id)}
                  onRestore={onFileRestore ? () => onFileRestore(file._id) : undefined}
                  viewMode="list"
                />
              </div>
              <div className="col-span-3 text-sm text-muted-foreground">
                {formatDate(file.updatedAt)}
              </div>
              <div className="col-span-2 text-sm text-muted-foreground">
                {formatFileSize(file.size)}
              </div>
              <div className="col-span-1"></div>
            </div>
          ))}

          {folders.length === 0 && files.length === 0 && (
            <div className="py-8 text-center text-muted-foreground">
              No items to display
            </div>
          )}
        </div>

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

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return bytes + " B";
  else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
  else if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + " MB";
  else return (bytes / 1073741824).toFixed(1) + " GB";
};

export default FileGrid;

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Folder as FolderType } from "@/types"; // Already aliased as FolderType
import { ArrowUp, FolderPlus, Upload } from "lucide-react";
import React, { useEffect, useRef, useState } from "react"; // Added React

interface FilesToolbarProps {
  currentFolder: FolderType | null;
  onNavigateUp: () => void;
  onCreateFolder: (name: string) => void;
  onUploadFiles: (files: FileList) => void;
  isUploading: boolean;
  uploadProgress: number;
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  onSearchSubmit: () => void;
  folderHistory: FolderType[]; // Added
  onBreadcrumbNavigate: (indexInHistory: number) => void; // Added
}

const FilesToolbar: React.FC<FilesToolbarProps> = ({
  currentFolder,
  onNavigateUp,
  onCreateFolder,
  onUploadFiles,
  isUploading,
  uploadProgress,
  searchQuery,
  onSearchQueryChange,
  onSearchSubmit,
  folderHistory, // Added
  onBreadcrumbNavigate, // Added
}) => {
  const [folderName, setFolderName] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [localSearchQuery, setLocalSearchQuery] = useState(searchQuery);

  useEffect(() => {
    setLocalSearchQuery(searchQuery);
  }, [searchQuery]);

  useEffect(() => {
    const handler = setTimeout(() => {
      onSearchQueryChange(localSearchQuery);
      onSearchSubmit();
    }, 500); // 500ms debounce

    return () => {
      clearTimeout(handler);
    };
  }, [localSearchQuery]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleCreateFolder = () => {
    if (folderName.trim()) {
      onCreateFolder(folderName);
      setFolderName("");
      setIsDialogOpen(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onUploadFiles(e.target.files);
      e.target.value = "";
    }
  };

  return (
    <div className="space-y-2">
      {/* Breadcrumbs Section */}
      <div className="flex items-center space-x-1 text-sm mb-2 overflow-x-auto pb-1 min-w-0">
        <button
          onClick={() => onBreadcrumbNavigate(-1)}
          className="font-medium text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap p-0 focus:outline-none focus:ring-0 bg-transparent border-none disabled:opacity-75 disabled:cursor-not-allowed"
          disabled={!currentFolder && folderHistory.length === 0}
        >
          <span className="truncate block max-w-[100px] sm:max-w-[150px]">My Drive</span>
        </button>
        {folderHistory.map((folder, index) => (
          <React.Fragment key={folder._id}>
            <span className="text-muted-foreground mx-1">/</span>
            <button
              onClick={() => onBreadcrumbNavigate(index)}
              className={`font-medium whitespace-nowrap p-0 focus:outline-none focus:ring-0 bg-transparent border-none ${
                index === folderHistory.length - 1
                  ? "text-foreground font-semibold cursor-default" // Current folder in breadcrumb
                  : "text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-75 disabled:cursor-not-allowed"
              }`}
              disabled={index === folderHistory.length - 1}
            >
              <span className="truncate block max-w-[100px] sm:max-w-[150px]">{folder.name}</span>
            </button>
          </React.Fragment>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {" "}
        {/* Added items-center for better alignment */}
        <Input
          type="search"
          placeholder="Search files by name..."
          value={localSearchQuery}
          onChange={(e) => {
            setLocalSearchQuery(e.target.value);
          }}
          className="max-w-xs h-9" // Adjusted styling
        />
        {currentFolder && (
          <Button variant="outline" size="sm" onClick={onNavigateUp}>
            <ArrowUp className="h-4 w-4 mr-2" />
            Up
          </Button>
        )}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <FolderPlus className="h-4 w-4 mr-2" />
              New Folder
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Create New Folder</DialogTitle>
              <DialogDescription>
                Enter a name for your new folder.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Input
                placeholder="Folder name"
                value={folderName}
                onChange={(e) => setFolderName(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateFolder}>Create</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <input
          type="file"
          multiple
          className="hidden"
          ref={fileInputRef}
          onChange={handleFileUpload}
          accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml,video/mp4,video/webm,application/pdf,text/plain,text/markdown,.doc,.docx,.xls,.xlsx,.ppt,.pptx,image/heic,image/heif,.heic,.heif"
        />
        <Button
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
        >
          <Upload className="h-4 w-4 mr-2" />
          Upload Files
        </Button>
      </div>

      {isUploading && (
        <div className="space-y-1">
          <div className="text-sm flex justify-between">
            <span>Uploading...</span>
            <span>{uploadProgress}%</span>
          </div>
          <Progress value={uploadProgress} className="h-2" />
        </div>
      )}
    </div>
  );
};

export default FilesToolbar;

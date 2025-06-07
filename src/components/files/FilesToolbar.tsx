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
import {
  ArrowUp,
  FolderPlus,
  FolderUp,
  LayoutGrid,
  List,
  RefreshCcw,
  Upload,
  DownloadCloud, // Added for Bulk Download
  Trash, // Added for Bulk Delete
} from "lucide-react"; // Added icons
import React, { forwardRef, useEffect, useRef, useState } from "react";

interface FilesToolbarProps {
  currentFolder: FolderType | null;
  onNavigateUp: () => void;
  onCreateFolder: (name: string) => void;
  onUploadFiles: (files: FileList) => void;
  onUploadFolder: (files: FileList) => void;
  isUploading: boolean;
  isUploadingFolder?: boolean;
  uploadProgress: number;
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  onSearchSubmit: () => void;
  folderHistory: FolderType[];
  onBreadcrumbNavigate: (indexInHistory: number) => void;
  viewMode: "card" | "list"; // Added
  onViewModeChange: (mode: "card" | "list") => void; // Added
  reloadFilesAndFolders: (resetCached: boolean) => void;
  selectedItemsCount: number; // Added for bulk actions
  onBulkDownload: () => void; // Added for bulk actions
  onBulkDelete: () => void; // Added for bulk actions
}

const FilesToolbar = forwardRef<HTMLDivElement, FilesToolbarProps>(
  (
    {
      currentFolder,
      onNavigateUp,
      onCreateFolder,
      onUploadFiles,
      onUploadFolder,
      isUploading,
      isUploadingFolder,
      uploadProgress,
      searchQuery,
      onSearchQueryChange,
      onSearchSubmit,
      folderHistory,
      onBreadcrumbNavigate,
      viewMode, // Added
      onViewModeChange, // Added
      reloadFilesAndFolders,
      selectedItemsCount, // Added
      onBulkDownload, // Added
      onBulkDelete, // Added
    },
    ref
  ) => {
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
    }, [localSearchQuery]); // Added dependencies based on usage

    const fileInputRef = useRef<HTMLInputElement>(null);
    const folderInputRef = useRef<HTMLInputElement>(null);

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

    // Define base and sticky classes
    // These would ideally be in a CSS module or global CSS file.
    const baseToolbarClasses = "space-y-2 transition-all duration-300 ease-out";
    // Note: Tailwind classes for fixed, top, left, right, bg, shadow, z-index can be used too.
    // Example: `fixed top-0 left-0 right-0 bg-white shadow-md z-50`
    // For the purpose of this exercise, we'll use a conditional class `toolbar-sticky-active`
    // and assume those styles are defined elsewhere (as per the CSS example provided in thought process).
    // To make it work without external CSS for now, I'll add some inline-ish styles for sticky state via class.
    // A more robust solution would use CSS Modules or a global stylesheet.

    // This is a simplified approach for demonstration.
    // In a real app, use dedicated CSS classes and stylesheets.

    return (
      <div
        ref={ref}
        className="bg-background filesToolbarBase sticky top-16 z-20"
      >
        {/* Breadcrumbs Section */}
        <div className="flex items-center space-x-1 text-sm pt-2 mb-2 overflow-x-auto pb-1 min-w-0">
          <button
            onClick={() => onBreadcrumbNavigate(-1)}
            className="font-medium text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap p-0 focus:outline-none focus:ring-0 bg-transparent border-none disabled:opacity-75 disabled:cursor-not-allowed"
            disabled={!currentFolder && folderHistory.length === 0}
          >
            <span className="truncate block max-w-[100px] sm:max-w-[150px]">
              My Drive
            </span>
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
                <span className="truncate block max-w-[100px] sm:max-w-[150px]">
                  {folder.name}
                </span>
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
                <Button
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                >
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
          <input
            type="file"
            className="hidden"
            ref={folderInputRef}
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                onUploadFolder(e.target.files);
                e.target.value = ""; // Clear the input
              }
            }}
            webkitdirectory=""
            directory=""
            multiple
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading || isUploadingFolder}
          >
            <Upload className="h-4 w-4 mr-2" />
            Upload Files
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => folderInputRef.current?.click()}
            disabled={isUploading || isUploadingFolder}
          >
            <FolderUp className="h-4 w-4 mr-2" />
            Upload Folder
          </Button>
          {/* Bulk Action Buttons */}
          <Button
            variant="outline"
            size="sm"
            onClick={onBulkDownload}
            disabled={selectedItemsCount === 0}
            className="h-9"
          >
            <DownloadCloud className="h-4 w-4 mr-2" />
            Download Selected ({selectedItemsCount})
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={onBulkDelete}
            disabled={selectedItemsCount === 0}
            className="h-9"
          >
            <Trash className="h-4 w-4 mr-2" />
            Delete Selected ({selectedItemsCount})
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => reloadFilesAndFolders(true)}
          >
            <RefreshCcw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          {/* View Mode Toggles */}
          <div className="flex items-center gap-1 ml-auto">
            <Button
              variant={viewMode === "card" ? "secondary" : "ghost"}
              size="icon"
              onClick={() => onViewModeChange("card")}
              aria-label="Card view"
            >
              <LayoutGrid className="h-5 w-5" />
            </Button>
            <Button
              variant={viewMode === "list" ? "secondary" : "ghost"}
              size="icon"
              onClick={() => onViewModeChange("list")}
              aria-label="List view"
            >
              <List className="h-5 w-5" />
            </Button>
          </div>
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
  }
);

export default FilesToolbar;

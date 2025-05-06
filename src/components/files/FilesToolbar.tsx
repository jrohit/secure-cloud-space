
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
import { Folder as FolderType } from "@/types";
import { ArrowUp, FolderPlus, RefreshCcw, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { useToast } from "@/components/ui/use-toast";

interface FilesToolbarProps {
  currentFolder: FolderType | null;
  onNavigateUp: () => void;
  onCreateFolder: (name: string) => void;
  onUploadFiles: (files: FileList) => void;
  isUploading: boolean;
  uploadProgress: number;
  reloadFilesAndFolders: (resetCached: boolean) => void;
  isTrashView?: boolean;
}

const FilesToolbar: React.FC<FilesToolbarProps> = ({
  currentFolder,
  onNavigateUp,
  onCreateFolder,
  onUploadFiles,
  isUploading,
  uploadProgress,
  reloadFilesAndFolders,
  isTrashView = false,
}) => {
  const [folderName, setFolderName] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

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
  
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isTrashView) {
      setIsDragging(true);
    }
  };
  
  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };
  
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    if (isTrashView) return;
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onUploadFiles(e.dataTransfer.files);
      toast({
        title: "Files added",
        description: `${e.dataTransfer.files.length} files added to upload queue`,
      });
    }
  };

  return (
    <div 
      className={`space-y-2 ${isDragging ? 'bg-secondary/50 border-2 border-dashed border-primary p-4 rounded-lg' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="flex flex-wrap gap-2">
        {currentFolder && (
          <Button variant="outline" size="sm" onClick={onNavigateUp}>
            <ArrowUp className="h-4 w-4 mr-2" />
            Up
          </Button>
        )}

        {!isTrashView && (
          <>
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
          </>
        )}

        <Button
          variant="outline"
          size="sm"
          onClick={() => reloadFilesAndFolders(true)}
        >
          <RefreshCcw className="h-4 w-4 mr-2" />
          Refresh
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
      
      {isDragging && (
        <div className="py-8 text-center">
          <p className="text-lg font-medium">Drop files here to upload</p>
        </div>
      )}
    </div>
  );
};

export default FilesToolbar;

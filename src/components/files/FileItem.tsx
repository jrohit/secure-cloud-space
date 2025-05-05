
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/AuthContext";
import { filesApi } from "@/services/api";
import { File } from "@/types";
import { formatDistanceToNow } from "date-fns";
import {
  Download,
  File as FileIcon,
  FileText,
  Image,
  MoreVertical,
  Trash2,
  Star,
  RotateCcw,
  ExternalLink,
} from "lucide-react";
import { useState } from "react";
import { useToast } from "@/components/ui/use-toast";

interface FileItemProps {
  file: File;
  onDelete: () => void;
  onPreview: () => void;
  onStar: () => void;
  onTrash: () => void;
  onRestore?: () => void;
  viewMode?: 'grid' | 'list';
}

const FileItem: React.FC<FileItemProps> = ({
  file,
  onDelete,
  onPreview,
  onStar,
  onTrash,
  onRestore,
  viewMode = 'grid'
}) => {
  const { token } = useAuth();
  const { toast } = useToast();
  const [isDownloading, setIsDownloading] = useState(false);

  const fileIcon = getFileIcon(file.type);
  const fileColor = getFileColor(file.type);
  const hasThumbnail = file.thumbnailPath || file.type.startsWith('image/');
  const previewUrl = token ? filesApi.getFilePreviewUrl(token, file._id) : null;

  const handleDownload = async () => {
    if (!token) return;

    setIsDownloading(true);
    try {
      const blob = await filesApi.downloadFile(token, file._id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.name;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error downloading file:", error);
      toast({
        title: "Error",
        description: "Failed to download file",
        variant: "destructive",
      });
    } finally {
      setIsDownloading(false);
    }
  };

  function getFileIcon(type: string) {
    if (type.startsWith("image/")) {
      return Image;
    } else if (
      type.includes("pdf") ||
      type.includes("document") ||
      type.includes("text")
    ) {
      return FileText;
    } else {
      return FileIcon;
    }
  }

  function getFileColor(type: string) {
    if (type.startsWith("image/")) {
      return "#34A853"; // Green
    } else if (type.includes("pdf")) {
      return "#EA4335"; // Red
    } else if (type.includes("document") || type.includes("text")) {
      return "#4285F4"; // Blue
    } else {
      return "#FBBC05"; // Yellow
    }
  }

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + " B";
    else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
    else if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + " MB";
    else return (bytes / 1073741824).toFixed(1) + " GB";
  }

  const FileIconComponent = fileIcon;

  if (viewMode === 'list') {
    return (
      <div className="flex items-center p-2 hover:bg-muted/50 rounded-md">
        <div className="flex items-center space-x-4 flex-1">
          <div className="flex-shrink-0">
            {hasThumbnail ? (
              <img
                src={previewUrl || ''}
                alt={file.name}
                className="h-10 w-10 object-cover rounded"
                onClick={onPreview}
              />
            ) : (
              <FileIconComponent style={{ color: fileColor }} className="h-10 w-10" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{file.name}</p>
            <p className="text-xs text-muted-foreground">
              {formatFileSize(file.size)} · {formatDistanceToNow(new Date(file.updatedAt), { addSuffix: true })}
            </p>
          </div>
        </div>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onPreview}>
              <ExternalLink className="mr-2 h-4 w-4" />
              <span>Preview</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleDownload} disabled={isDownloading}>
              <Download className="mr-2 h-4 w-4" />
              <span>Download</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onStar}>
              <Star className={`mr-2 h-4 w-4 ${file.isStarred ? 'fill-yellow-400' : ''}`} />
              <span>{file.isStarred ? 'Unstar' : 'Star'}</span>
            </DropdownMenuItem>
            {file.isTrash ? (
              <>
                <DropdownMenuItem onClick={onRestore}>
                  <RotateCcw className="mr-2 h-4 w-4" />
                  <span>Restore</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onDelete} className="text-destructive">
                  <Trash2 className="mr-2 h-4 w-4" />
                  <span>Delete permanently</span>
                </DropdownMenuItem>
              </>
            ) : (
              <DropdownMenuItem onClick={onTrash}>
                <Trash2 className="mr-2 h-4 w-4" />
                <span>Move to trash</span>
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  }

  return (
    <Card className="overflow-hidden transition-all duration-200 hover:shadow-md relative">
      {file.isStarred && (
        <div className="absolute top-1 right-1 z-10">
          <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
        </div>
      )}
      <CardContent className="p-0" onClick={onPreview}>
        <div className="aspect-square flex items-center justify-center bg-muted/30 cursor-pointer">
          {hasThumbnail ? (
            <img
              src={previewUrl || ''}
              alt={file.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <FileIconComponent
              style={{ color: fileColor }}
              className="h-16 w-16 opacity-80"
            />
          )}
        </div>
      </CardContent>
      <CardFooter className="p-2 flex-col items-start gap-1">
        <div className="w-full flex justify-between items-start">
          <div className="truncate flex-1">
            <h3 className="text-sm font-medium truncate" title={file.name}>
              {file.name}
            </h3>
            <p className="text-xs text-muted-foreground">
              {formatFileSize(file.size)}
            </p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onPreview}>
                <ExternalLink className="mr-2 h-4 w-4" />
                <span>Preview</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleDownload} disabled={isDownloading}>
                <Download className="mr-2 h-4 w-4" />
                <span>Download</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onStar}>
                <Star className={`mr-2 h-4 w-4 ${file.isStarred ? 'fill-yellow-400' : ''}`} />
                <span>{file.isStarred ? 'Unstar' : 'Star'}</span>
              </DropdownMenuItem>
              {file.isTrash ? (
                <>
                  <DropdownMenuItem onClick={onRestore}>
                    <RotateCcw className="mr-2 h-4 w-4" />
                    <span>Restore</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={onDelete} className="text-destructive">
                    <Trash2 className="mr-2 h-4 w-4" />
                    <span>Delete permanently</span>
                  </DropdownMenuItem>
                </>
              ) : (
                <DropdownMenuItem onClick={onTrash}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  <span>Move to trash</span>
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <p className="text-xs text-muted-foreground">
          Modified{" "}
          {formatDistanceToNow(new Date(file.updatedAt), { addSuffix: true })}
        </p>
      </CardFooter>
    </Card>
  );
};

export default FileItem;

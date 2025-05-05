
import { useState } from "react";
import { File } from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/AuthContext";
import { filesApi } from "@/services/api";
import { formatDistanceToNow } from "date-fns";
import { FileText, Download, Trash2, MoreVertical, Image, File as FileIcon } from "lucide-react";

interface FileItemProps {
  file: File;
  onDelete: () => void;
}

const FileItem: React.FC<FileItemProps> = ({ file, onDelete }) => {
  const { token } = useAuth();
  const [isDownloading, setIsDownloading] = useState(false);
  
  const fileIcon = getFileIcon(file.type);
  const fileColor = getFileColor(file.type);
  
  const handleDownload = async () => {
    if (!token) return;
    
    setIsDownloading(true);
    try {
      const blob = await filesApi.downloadFile(token, file.id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.name;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error downloading file:", error);
    } finally {
      setIsDownloading(false);
    }
  };
  
  function getFileIcon(type: string) {
    if (type.startsWith("image/")) {
      return Image;
    } else if (type.includes("pdf") || type.includes("document") || type.includes("text")) {
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
  
  return (
    <Card className="overflow-hidden transition-all duration-200 hover:shadow-md">
      <CardContent className="p-0">
        <div className="aspect-square flex items-center justify-center bg-muted/30">
          <FileIconComponent 
            style={{ color: fileColor }} 
            className="h-16 w-16 opacity-80" 
          />
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
              <DropdownMenuItem onClick={handleDownload} disabled={isDownloading}>
                <Download className="mr-2 h-4 w-4" />
                <span>Download</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onDelete} className="text-destructive">
                <Trash2 className="mr-2 h-4 w-4" />
                <span>Delete</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <p className="text-xs text-muted-foreground">
          Modified {formatDistanceToNow(new Date(file.updatedAt), { addSuffix: true })}
        </p>
      </CardFooter>
    </Card>
  );
};

export default FileItem;

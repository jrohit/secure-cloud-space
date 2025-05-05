
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Download, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { filesApi } from "@/services/api";
import { FileViewProps } from "@/types";
import { useState } from "react";

// Define API_URL as a constant
const API_URL = "http://localhost:5000/api";

const FilePreviewDialog: React.FC<FileViewProps> = ({
  file,
  onClose,
  onNext,
  onPrevious,
  hasNext = false,
  hasPrevious = false,
}) => {
  const { token } = useAuth();
  const [isDownloading, setIsDownloading] = useState(false);
  
  if (!token) return null;

  const previewUrl = filesApi.getFilePreviewUrl(token, file._id);
  
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
    } finally {
      setIsDownloading(false);
    }
  };

  const renderPreview = () => {
    if (file.type.startsWith("image/")) {
      return (
        <img
          src={previewUrl}
          alt={file.name}
          className="max-h-[80vh] max-w-full object-contain"
        />
      );
    } else if (file.type.startsWith("video/")) {
      return (
        <video controls className="max-h-[80vh] max-w-full">
          <source src={`${API_URL}/files/${file._id}/download?token=${token}`} type={file.type} />
          Your browser does not support the video tag.
        </video>
      );
    } else if (file.type === "application/pdf") {
      return (
        <iframe
          src={`${API_URL}/files/${file._id}/download?token=${token}`}
          title={file.name}
          className="h-[80vh] w-full"
        />
      );
    } else {
      return (
        <div className="flex h-[50vh] flex-col items-center justify-center">
          <p className="mb-4 text-lg font-medium">Preview not available for this file type</p>
          <Button onClick={handleDownload} disabled={isDownloading}>
            <Download className="mr-2 h-4 w-4" />
            Download
          </Button>
        </div>
      );
    }
  };

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-6xl p-0 overflow-hidden">
        <div className="absolute right-4 top-4 z-50 flex gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleDownload}
            disabled={isDownloading}
          >
            <Download className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex h-full items-center justify-center p-6">
          {hasPrevious && (
            <Button
              variant="ghost"
              size="icon"
              className="mr-2"
              onClick={onPrevious}
            >
              <ChevronLeft className="h-6 w-6" />
            </Button>
          )}

          <div className="flex-1 flex justify-center">
            {renderPreview()}
          </div>

          {hasNext && (
            <Button
              variant="ghost"
              size="icon"
              className="ml-2"
              onClick={onNext}
            >
              <ChevronRight className="h-6 w-6" />
            </Button>
          )}
        </div>

        <div className="p-4 bg-muted/50 border-t">
          <h3 className="text-lg font-medium">{file.name}</h3>
          <p className="text-sm text-muted-foreground">
            {file.type} · {formatFileSize(file.size)}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return bytes + " B";
  else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
  else if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + " MB";
  else return (bytes / 1073741824).toFixed(1) + " GB";
};

export default FilePreviewDialog;

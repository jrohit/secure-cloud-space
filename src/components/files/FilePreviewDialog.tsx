
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Download, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { filesApi } from "@/services/api";
import { FileViewProps } from "@/types";
import { useState, useEffect } from "react";

const FilePreviewDialog: React.FC<FileViewProps> = ({
  file,
  onClose,
  onNext,
  onPrevious,
  hasNext = false,
  hasPrevious = false,
}) => {
  const { token, user } = useAuth();
  const [isDownloading, setIsDownloading] = useState(false);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    let isMounted = true;
    
    const fetchAndDecryptFile = async () => {
      if (!token || !user) return;
      
      setIsLoading(true);
      try {
        // For media files, fetch and decrypt on load
        if (file.type.startsWith('image/') || file.type.startsWith('video/') || file.type.startsWith('audio/')) {
          const blob = await filesApi.downloadFile(token, file._id, user.id);
          if (isMounted) {
            const url = window.URL.createObjectURL(blob);
            setObjectUrl(url);
          }
        }
      } catch (error) {
        console.error("Error loading file:", error);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };
    
    fetchAndDecryptFile();
    
    return () => {
      isMounted = false;
      if (objectUrl) {
        window.URL.revokeObjectURL(objectUrl);
      }
    };
  }, [file._id, token, user]);
  
  if (!token || !user) return null;

  const handleDownload = async () => {
    if (!token) return;

    setIsDownloading(true);
    try {
      const blob = await filesApi.downloadFile(token, file._id, user.id);
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
    if (isLoading) {
      return (
        <div className="flex h-[50vh] flex-col items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
          <p className="mt-4 text-sm text-muted-foreground">Loading file preview...</p>
        </div>
      );
    }

    if (file.type.startsWith("image/")) {
      return (
        <img
          src={objectUrl || undefined}
          alt={file.name}
          className="max-h-[80vh] max-w-full object-contain"
        />
      );
    } else if (file.type.startsWith("video/")) {
      return (
        <video 
          controls 
          className="max-h-[80vh] max-w-full"
          controlsList="nodownload"
          autoPlay
        >
          <source src={objectUrl || undefined} type={file.type} />
          Your browser does not support the video tag.
        </video>
      );
    } else if (file.type.startsWith("audio/")) {
      return (
        <div className="flex flex-col items-center justify-center py-8">
          <div className="w-64 h-64 bg-muted rounded-lg flex items-center justify-center mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 13a2 2 0 0 0 2 2h3a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"></path>
              <path d="M14 13a2 2 0 0 0 2 2h3a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2h-3a2 2 0 0 0-2 2Z"></path>
              <path d="M10 21v-6"></path>
              <path d="M7 18h6"></path>
              <path d="M19 21v-6"></path>
            </svg>
          </div>
          <audio 
            controls 
            className="w-full max-w-md"
            controlsList="nodownload"
            autoPlay
          >
            <source src={objectUrl || undefined} type={file.type} />
            Your browser does not support the audio tag.
          </audio>
        </div>
      );
    } else if (file.type === "application/pdf") {
      return (
        <iframe
          src={objectUrl || undefined}
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

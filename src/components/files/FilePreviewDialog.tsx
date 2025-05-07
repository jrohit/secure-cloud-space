
import { useState, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Download, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { filesApi } from "@/services/api";
import { FileViewProps } from "@/types";
import { Spinner } from "@/components/ui/Spinner";
import { userEncryptionService } from "@/services/api/userEncryption";

const FilePreviewDialog: React.FC<FileViewProps> = ({
  file,
  onClose,
  onNext,
  onPrevious,
  hasNext = false,
  hasPrevious = false,
}) => {
  const { token, user, masterKey } = useAuth();
  const [isDownloading, setIsDownloading] = useState(false);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [previewType, setPreviewType] = useState<string | null>(null);
  const [decryptedFileName, setDecryptedFileName] = useState<string>(file.name);
  
  useEffect(() => {
    if (masterKey && file.metadataEncrypted) {
      const decrypted = userEncryptionService.decryptName(file.name, masterKey);
      setDecryptedFileName(decrypted || file.name);
    } else {
      setDecryptedFileName(file.name);
    }
  }, [file.name, masterKey, file.metadataEncrypted]);
  
  useEffect(() => {
    let isMounted = true;
    
    const fetchAndDecryptFile = async () => {
      if (!token || !user) return;
      
      setIsLoading(true);
      setLoadingError(null);
      try {
        // For all supported media types, fetch and decrypt on load
        if (file.type.startsWith('image/') || 
            file.type.startsWith('video/') || 
            file.type.startsWith('audio/') ||
            file.type === 'application/pdf') {
          
          console.log("Fetching and decrypting file:", decryptedFileName, file.type);
          const url = await filesApi.getCachedFileUrl(token, file._id, user.id);
          
          if (isMounted) {
            console.log("File loaded successfully, setting object URL");
            setObjectUrl(url);
            setPreviewType(file.type);
            setIsLoading(false);
          }
        } else {
          if (isMounted) {
            setIsLoading(false);
          }
        }
      } catch (error) {
        console.error("Error loading file:", error);
        if (isMounted) {
          setLoadingError(`Failed to load file: ${error instanceof Error ? error.message : 'Unknown error'}`);
          setIsLoading(false);
        }
      }
    };
    
    fetchAndDecryptFile();
    
    return () => {
      isMounted = false;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [file._id, file.type, token, user?.id, decryptedFileName]);
  
  if (!token || !user) return null;

  const handleDownload = async () => {
    if (!token) return;

    setIsDownloading(true);
    try {
      const blob = await filesApi.downloadFile(token, file._id, user.id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = decryptedFileName;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error downloading file:", error);
      setLoadingError(`Failed to download file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsDownloading(false);
    }
  };

  const renderPreview = () => {
    if (isLoading) {
      return (
        <div className="flex h-[50vh] flex-col items-center justify-center">
          <Spinner className="h-12 w-12" />
          <p className="mt-4 text-sm text-muted-foreground">Loading file preview...</p>
        </div>
      );
    }
    
    if (loadingError) {
      return (
        <div className="flex h-[50vh] flex-col items-center justify-center text-destructive">
          <p className="text-center">{loadingError}</p>
          <Button onClick={handleDownload} className="mt-4" disabled={isDownloading}>
            <Download className="mr-2 h-4 w-4" />
            Try downloading instead
          </Button>
        </div>
      );
    }

    // Check if we have a valid previewType and objectUrl
    if (!previewType || !objectUrl) {
      return (
        <div className="flex h-[50vh] flex-col items-center justify-center">
          <p className="text-center text-muted-foreground">
            Preview not available for this file type
          </p>
          <Button onClick={handleDownload} className="mt-4" disabled={isDownloading}>
            <Download className="mr-2 h-4 w-4" />
            Download
          </Button>
        </div>
      );
    }

    if (previewType.startsWith("image/")) {
      return (
        <div className="flex items-center justify-center h-full max-h-[70vh] overflow-hidden">
          <img
            src={objectUrl}
            alt={decryptedFileName}
            className="max-h-full max-w-full object-contain"
            onError={() => setLoadingError("Failed to load image")}
          />
        </div>
      );
    } else if (previewType.startsWith("video/")) {
      return (
        <div className="flex items-center justify-center h-full max-h-[70vh]">
          <video 
            controls 
            className="max-h-full max-w-full"
            controlsList="nodownload"
            autoPlay
            onError={() => setLoadingError("Failed to load video")}
          >
            <source src={objectUrl} type={previewType} />
            Your browser does not support the video tag.
          </video>
        </div>
      );
    } else if (previewType.startsWith("audio/")) {
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
            onError={() => setLoadingError("Failed to load audio")}
          >
            <source src={objectUrl} type={previewType} />
            Your browser does not support the audio tag.
          </audio>
        </div>
      );
    } else if (previewType === "application/pdf") {
      return (
        <iframe
          src={objectUrl}
          title={decryptedFileName}
          className="h-[70vh] w-full"
          onError={() => setLoadingError("Failed to load PDF")}
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
      <DialogContent className="max-w-6xl p-0 overflow-hidden flex flex-col max-h-[85vh]">
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

        <div className="flex-1 overflow-auto flex items-center justify-center p-4">
          <div className="flex w-full justify-center items-center">
            {hasPrevious && (
              <Button
                variant="ghost"
                size="icon"
                className="mr-2 h-10 w-10 shrink-0"
                onClick={onPrevious}
              >
                <ChevronLeft className="h-6 w-6" />
              </Button>
            )}

            <div className="flex-1 flex justify-center overflow-hidden">
              {renderPreview()}
            </div>

            {hasNext && (
              <Button
                variant="ghost"
                size="icon"
                className="ml-2 h-10 w-10 shrink-0"
                onClick={onNext}
              >
                <ChevronRight className="h-6 w-6" />
              </Button>
            )}
          </div>
        </div>

        <div className="p-4 bg-muted/50 border-t">
          <h3 className="text-lg font-medium">{decryptedFileName}</h3>
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

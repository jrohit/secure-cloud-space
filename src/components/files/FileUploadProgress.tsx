import { useState, useEffect } from 'react';
import { X, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { UploadingFile } from '@/types';

interface FileUploadProgressProps {
  uploadingFiles: UploadingFile[];
  onDismissFile: (id: string) => void;
  onDismissAll: () => void;
}

export const FileUploadProgress: React.FC<FileUploadProgressProps> = ({
  uploadingFiles,
  onDismissFile,
  onDismissAll
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [minimized, setMinimized] = useState(false);

  useEffect(() => {
    if (uploadingFiles.length > 0) {
      setIsVisible(true);
    } else {
      // Keep the component visible for a moment after uploads complete
      const timer = setTimeout(() => {
        setIsVisible(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [uploadingFiles]);

  if (!isVisible) return null;

  const activeUploadsCount = uploadingFiles.filter(f => 
    f.status === 'encrypting' || f.status === 'uploading'
  ).length;
  
  const completedUploadsCount = uploadingFiles.filter(f => 
    f.status === 'complete'
  ).length;
  
  const failedUploadsCount = uploadingFiles.filter(f => 
    f.status === 'error'
  ).length;

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80">
      <Card className="shadow-lg bg-background">
        <div className="flex items-center justify-between border-b p-2">
          <div className="flex items-center space-x-2">
            {activeUploadsCount > 0 && (
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
            )}
            <h3 className="text-sm font-medium">
              {activeUploadsCount > 0 
                ? `Uploading ${activeUploadsCount} ${activeUploadsCount === 1 ? 'file' : 'files'}` 
                : `Upload ${completedUploadsCount > 0 ? 'completed' : 'failed'}`}
            </h3>
          </div>
          <div className="flex items-center space-x-1">
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-5 w-5"
              onClick={() => setMinimized(!minimized)}
            >
              <span className="sr-only">
                {minimized ? 'Expand' : 'Minimize'}
              </span>
              {minimized ? '+' : '-'}
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-5 w-5"
              onClick={onDismissAll}
            >
              <X className="h-3 w-3" />
              <span className="sr-only">Close</span>
            </Button>
          </div>
        </div>

        {!minimized && (
          <CardContent className="max-h-80 overflow-auto p-2 space-y-2">
            {uploadingFiles.map(file => (
              <div key={file.id} className="relative">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center space-x-2 overflow-hidden">
                    {file.status === 'encrypting' && (
                      <span className="text-xs text-blue-500 animate-pulse">Encrypting</span>
                    )}
                    {file.status === 'uploading' && (
                      <span className="text-xs text-amber-500">Uploading</span>
                    )}
                    {file.status === 'complete' && (
                      <CheckCircle className="h-3 w-3 text-green-500" />
                    )}
                    {file.status === 'error' && (
                      <AlertCircle className="h-3 w-3 text-destructive" />
                    )}
                    <span className="text-xs truncate max-w-[180px]" title={file.file.name}>
                      {file.file.name}
                    </span>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-5 w-5"
                    onClick={() => onDismissFile(file.id)}
                  >
                    <X className="h-3 w-3" />
                    <span className="sr-only">Dismiss</span>
                  </Button>
                </div>
                <Progress 
                  value={file.progress} 
                  className={cn(
                    "h-1", 
                    file.status === 'complete' && "bg-green-100",
                    file.status === 'error' && "bg-red-100"
                  )}
                  indicatorClassName={cn(
                    file.status === 'complete' && "bg-green-500",
                    file.status === 'error' && "bg-red-500"
                  )}
                />
                {file.status === 'error' && (
                  <p className="text-xs text-destructive mt-1">
                    {file.error || 'Upload failed'}
                  </p>
                )}
              </div>
            ))}
          </CardContent>
        )}
      </Card>
    </div>
  );
};

export default FileUploadProgress;

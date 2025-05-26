import React, { useEffect, useState, useRef } from 'react'; // Ensure useRef is imported
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Spinner } from '@/components/ui/Spinner'; // Assuming you have a Spinner component
import { marked } from 'marked';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';
import pdfWorkerEntryPoint from 'pdfjs-dist/build/pdf.worker.min.mjs?worker&url'; // New import

// Configure pdfjs worker
pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerEntryPoint; // Changed to use Vite's worker URL

interface FilePreviewDialogProps {
  isOpen: boolean;
  onClose: () => void;
  fileContent: ArrayBuffer | null;
  fileName: string;
  fileType: string;
}

const FilePreviewDialog: React.FC<FilePreviewDialogProps> = ({
  isOpen,
  onClose,
  fileContent,
  fileName,
  fileType,
}) => {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [textString, setTextString] = useState<string | null>(null);
  const [numPdfPages, setNumPdfPages] = useState<number | null>(null);
  const [pdfPageNumber, setPdfPageNumber] = useState<number>(1);
  const [pdfObjectUrl, setPdfObjectUrl] = useState<string | null>(null);
  const pdfObjectUrlRef = useRef<string | null>(null); // Ref to manage lifecycle for revoke

  useEffect(() => {
    // Initial cleanup for image, video, audio URLs and text
    setImageUrl(null);
    setVideoUrl(null);
    setAudioUrl(null);
    setTextString(null);
    setNumPdfPages(null); // Reset PDF pages
    setPdfPageNumber(1);  // Reset PDF page number

    // Revoke previous PDF object URL if it exists (using the ref)
    if (pdfObjectUrlRef.current) {
        URL.revokeObjectURL(pdfObjectUrlRef.current);
        pdfObjectUrlRef.current = null;
    }
    setPdfObjectUrl(null); // Clear the state

    if (!fileContent || !isOpen) {
        return;
    }

    let localImageVideoAudioUrlToRevoke: string | null = null;

    if (fileType.startsWith('image/')) {
        const blob = new Blob([fileContent], { type: fileType });
        localImageVideoAudioUrlToRevoke = URL.createObjectURL(blob);
        setImageUrl(localImageVideoAudioUrlToRevoke);
    } else if (fileType.startsWith('video/')) {
        const blob = new Blob([fileContent], { type: fileType });
        localImageVideoAudioUrlToRevoke = URL.createObjectURL(blob);
        setVideoUrl(localImageVideoAudioUrlToRevoke);
    } else if (fileType.startsWith('audio/')) {
        const blob = new Blob([fileContent], { type: fileType });
        localImageVideoAudioUrlToRevoke = URL.createObjectURL(blob);
        setAudioUrl(localImageVideoAudioUrlToRevoke);
    } else if (fileType === 'text/plain' || fileType === 'text/markdown') {
        const decoder = new TextDecoder();
        setTextString(decoder.decode(fileContent));
    } else if (fileType === 'application/pdf' && fileContent) {
        // Create Blob and Object URL for PDF
        const blob = new Blob([fileContent], { type: 'application/pdf' });
        const newUrl = URL.createObjectURL(blob);
        setPdfObjectUrl(newUrl);
        pdfObjectUrlRef.current = newUrl; // Store in ref for precise cleanup
    }

    // Cleanup for local image/video/audio URLs created in this effect run
    return () => {
        if (localImageVideoAudioUrlToRevoke) {
            URL.revokeObjectURL(localImageVideoAudioUrlToRevoke);
        }
        // PDF Object URL is managed by the ref and will be cleaned up
        // at the start of the next effect cycle or on unmount.
    };
  }, [fileContent, fileType, isOpen]);

  useEffect(() => {
    // This effect runs only on mount and its cleanup runs only on unmount
    return () => {
        if (pdfObjectUrlRef.current) {
            URL.revokeObjectURL(pdfObjectUrlRef.current);
            pdfObjectUrlRef.current = null;
        }
    };
  }, []); // Empty dependency array

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPdfPages(numPages);
    setPdfPageNumber(1); // Reset to first page on new document load
  };

  const renderContent = () => {
    // At the beginning of renderContent or just before the main if/else chain for types
    if (fileContent && fileType === 'application/pdf') {
      console.log('[PreviewDialog] Entry - fileContent.byteLength:', fileContent.byteLength);
      try {
        const sliceTestAtEntry = fileContent.slice(0);
        console.log('[PreviewDialog] Entry - fileContent slice test successful, new buffer byteLength:', sliceTestAtEntry.byteLength);
      } catch (e) {
        console.error('[PreviewDialog] Entry - Error trying to slice fileContent upon receiving in dialog:', e);
      }
    }

    if (!fileContent) {
      return (
        <div className="flex justify-center items-center h-64">
          <Spinner className="h-12 w-12" />
        </div>
      );
    }

    if (fileType.startsWith('image/') && imageUrl) {
      return <img src={imageUrl} alt={fileName} className="w-full h-full object-contain" />;
    }

    if (fileType === 'text/plain' && textString !== null) {
      return <pre className="whitespace-pre-wrap break-all h-full overflow-auto p-4 bg-muted">{textString}</pre>;
    }

    if (fileType === 'text/markdown' && textString !== null) {
      // For this subtask, assuming marked's default sanitization is sufficient.
      // In a production app, consider a more robust HTML sanitizer like DOMPurify if markdown source is untrusted.
      const rawMarkup = marked.parse(textString);
      return <div dangerouslySetInnerHTML={{ __html: rawMarkup }} className="prose dark:prose-invert h-full overflow-auto p-4" />;
    }

    if (fileType === 'application/pdf') {
        // Your existing console logs related to fileContent.byteLength can be kept if desired for debugging,
        // but they are not directly used for the <Document file={...}> prop anymore.
        // For example:
        // console.log('[PreviewDialog] PDF Block - fileContent.byteLength before object URL:', fileContent?.byteLength);

        if (!pdfObjectUrl) {
            // Show spinner or a loading message if the object URL isn't ready yet
            return (
                <div className="flex justify-center items-center h-64">
                    <Spinner className="h-12 w-12" />
                </div>
            );
        }
        
        console.log('FilePreviewDialog: Attempting to render PDF using object URL:', pdfObjectUrl);

        return (
            <div className="w-full h-full flex flex-col items-center overflow-auto">
                <Document
                    file={pdfObjectUrl} // Use the object URL from state
                    onLoadSuccess={onDocumentLoadSuccess}
                    onLoadError={(error) => {
                        console.error('PDF load error:', error);
                        // Consider displaying a more user-friendly error message in the UI here
                        return <p>Error loading PDF file. It may be corrupted or unsupported.</p>;
                    }}
                    loading={<Spinner className="h-8 w-8 my-4" />}
                    className="max-w-full"
                >
                    <Page
                        pageNumber={pdfPageNumber}
                        renderTextLayer={true}
                        renderAnnotationLayer={true}
                        width={window.innerWidth}
                    />
                </Document>
                {numPdfPages && (
                    <div className="flex items-center gap-2 mt-2">
                        <button
                            onClick={() => setPdfPageNumber(prev => Math.max(1, prev - 1))}
                            disabled={pdfPageNumber <= 1}
                            className="px-2 py-1 border rounded disabled:opacity-50"
                        >
                            Prev
                        </button>
                        <span>Page {pdfPageNumber} of {numPdfPages}</span>
                        <button
                            onClick={() => setPdfPageNumber(prev => Math.min(numPdfPages, prev + 1))}
                            disabled={pdfPageNumber >= numPdfPages}
                            className="px-2 py-1 border rounded disabled:opacity-50"
                        >
                            Next
                        </button>
                    </div>
                )}
            </div>
        );
    }

    if (fileType.startsWith('video/') && videoUrl) {
      return <video controls src={videoUrl} className="w-full h-full object-contain" />;
    }

    if (fileType.startsWith('audio/') && audioUrl) {
      return <audio controls src={audioUrl} className="w-full mt-4" />;
    }

    return <p>Preview not available for this file type: {fileType}</p>;
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-screen h-screen max-w-screen max-h-screen p-0 flex flex-col">
        <DialogHeader>
          <DialogTitle className="truncate pr-6">{fileName}</DialogTitle>
          {/* <DialogDescription>Type: {fileType}</DialogDescription> */}
        </DialogHeader>
        <div className="flex-grow overflow-auto">
          {renderContent()}
        </div>
        <DialogFooter>
          <button onClick={onClose} className="px-4 py-2 bg-primary text-primary-foreground rounded">Close</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default FilePreviewDialog;

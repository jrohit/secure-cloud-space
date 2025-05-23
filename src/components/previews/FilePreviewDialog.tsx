import React, { useEffect, useState } from 'react';
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

// Configure pdfjs worker
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

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
  const [textString, setTextString] = useState<string | null>(null);
  const [numPdfPages, setNumPdfPages] = useState<number | null>(null);
  const [pdfPageNumber, setPdfPageNumber] = useState<number>(1);

  useEffect(() => {
    // Cleanup previous states when fileContent changes or dialog closes
    setImageUrl(null);
    setTextString(null);
    setNumPdfPages(null);
    setPdfPageNumber(1);

    if (!fileContent) return;

    if (fileType.startsWith('image/')) {
      const blob = new Blob([fileContent], { type: fileType });
      const objectUrl = URL.createObjectURL(blob);
      setImageUrl(objectUrl);

      return () => {
        URL.revokeObjectURL(objectUrl);
        setImageUrl(null);
      };
    } else if (fileType === 'text/plain' || fileType === 'text/markdown') {
      const decoder = new TextDecoder();
      setTextString(decoder.decode(fileContent));
    }
  }, [fileContent, fileType, isOpen]); // Add isOpen to trigger cleanup when dialog closes

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPdfPages(numPages);
    setPdfPageNumber(1); // Reset to first page on new document load
  };

  const renderContent = () => {
    if (!fileContent) {
      return (
        <div className="flex justify-center items-center h-64">
          <Spinner className="h-12 w-12" />
        </div>
      );
    }

    if (fileType.startsWith('image/') && imageUrl) {
      return <img src={imageUrl} alt={fileName} className="max-w-full max-h-[70vh] object-contain" />;
    }

    if (fileType === 'text/plain' && textString !== null) {
      return <pre className="whitespace-pre-wrap break-all overflow-auto max-h-[70vh] p-2 bg-muted rounded">{textString}</pre>;
    }

    if (fileType === 'text/markdown' && textString !== null) {
      // For this subtask, assuming marked's default sanitization is sufficient.
      // In a production app, consider a more robust HTML sanitizer like DOMPurify if markdown source is untrusted.
      const rawMarkup = marked.parse(textString);
      return <div dangerouslySetInnerHTML={{ __html: rawMarkup }} className="prose dark:prose-invert overflow-auto max-h-[70vh]" />;
    }

    if (fileType === 'application/pdf') {
      return (
        <div className="flex flex-col items-center">
          <Document
            file={{ data: fileContent }}
            onLoadSuccess={onDocumentLoadSuccess}
            onLoadError={(error) => {
              console.error('PDF load error:', error);
              return <p>Error loading PDF file. It may be corrupted or unsupported.</p>;
            }}
            loading={<Spinner className="h-8 w-8 my-4" />}
            className="max-w-full"
          >
            <Page 
              pageNumber={pdfPageNumber} 
              renderTextLayer={true}
              renderAnnotationLayer={true}
              width={Math.min(window.innerWidth * 0.8, 800)} // Adjust width as needed
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

    return <p>Preview not available for this file type: {fileType}</p>;
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl w-full max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="truncate pr-6">{fileName}</DialogTitle>
          {/* <DialogDescription>Type: {fileType}</DialogDescription> */}
        </DialogHeader>
        <div className="flex-grow overflow-auto py-4">
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

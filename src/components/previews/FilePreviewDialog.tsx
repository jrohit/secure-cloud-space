import React, { useEffect, useState, useRef } from "react";
import heic2any from "heic2any";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/Spinner"; // Assuming you have a Spinner component
import { Button } from "@/components/ui/button"; // Added for zoom controls
import { marked } from "marked";
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, RefreshCcw } from "lucide-react"; // Added zoom icons
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/esm/Page/AnnotationLayer.css";
import "react-pdf/dist/esm/Page/TextLayer.css";
import pdfWorkerEntryPoint from "pdfjs-dist/build/pdf.worker.min.mjs?worker&url"; // New import

// Configure pdfjs worker
pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerEntryPoint; // Changed to use Vite's worker URL

interface FilePreviewDialogProps {
  isOpen: boolean;
  onClose: () => void;
  fileContent: ArrayBuffer | null;
  fileName: string;
  fileType: string;
  onNext?: () => void;
  onPrevious?: () => void;
  canNavigateNext?: boolean;
  canNavigatePrevious?: boolean;
}

const FilePreviewDialog: React.FC<FilePreviewDialogProps> = ({
  isOpen,
  onClose,
  fileContent,
  fileName,
  fileType,
  onNext,
  onPrevious,
  canNavigateNext,
  canNavigatePrevious,
}) => {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [textString, setTextString] = useState<string | null>(null);
  const [numPdfPages, setNumPdfPages] = useState<number | null>(null);
  const [pdfPageNumber, setPdfPageNumber] = useState<number>(1);
  const [pdfObjectUrl, setPdfObjectUrl] = useState<string | null>(null);
  const pdfObjectUrlRef = useRef<string | null>(null);

  // State for zoom and pan
  const [scale, setScale] = useState<number>(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const imageContainerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });


  // Zoom handlers
  const handleZoomIn = () => setScale(prevScale => Math.min(prevScale * 1.2, 5));
  const handleZoomOut = () => setScale(prevScale => Math.max(prevScale / 1.2, 0.2));
  const handleZoomReset = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  // Panning handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (scale <= 1) return; // Allow dragging only when zoomed
    e.preventDefault(); // Prevent text selection or other default behaviors
    setIsDragging(true);
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging || scale <= 1) return;
    e.preventDefault();
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Effect to reset position when scale is 1 (or image changes)
  useEffect(() => {
    if (scale === 1) {
      setPosition({ x: 0, y: 0 });
    }
  }, [scale, imageUrl]); // imageUrl dependency ensures reset for new images


  useEffect(() => {
    // Revoke old object URLs before creating new ones or if component is not open
    if (imageUrl && imageUrl.startsWith("blob:")) {
      URL.revokeObjectURL(imageUrl);
    }
    if (videoUrl && videoUrl.startsWith("blob:")) {
      URL.revokeObjectURL(videoUrl);
    }
    if (audioUrl && audioUrl.startsWith("blob:")) {
      URL.revokeObjectURL(audioUrl);
    }
    if (pdfObjectUrlRef.current) {
      URL.revokeObjectURL(pdfObjectUrlRef.current);
      pdfObjectUrlRef.current = null;
    }

    // Reset states
    setImageUrl(null);
    setVideoUrl(null);
    setAudioUrl(null);
    setTextString(null);
    setNumPdfPages(null);
    setPdfPageNumber(1);
    setPdfObjectUrl(null);
    handleZoomReset(); // Reset zoom/pan when dialog opens or file changes

    if (!fileContent || !isOpen) {
      return;
    }

    if (fileType.startsWith("image/")) {
      if (fileType === "image/heic" || fileType === "image/heif") {
        const originalHeicBlob = new Blob([fileContent], { type: fileType });
        (async () => {
          try {
            const conversionResult = await heic2any({
              blob: originalHeicBlob,
              toType: "image/jpeg",
              quality: 0.9,
              strict: false, // Keep strict: false as per previous instruction
            });
            const convertedBlob = Array.isArray(conversionResult)
              ? conversionResult[0]
              : conversionResult;
            const objectUrl = URL.createObjectURL(convertedBlob);
            setImageUrl(objectUrl);
          } catch (conversionError: any) {
            console.error(
              "[PreviewDialog] HEIC conversion attempt failed:",
              conversionError,
            );
            if (
              conversionError &&
              conversionError.message &&
              conversionError.message.includes(
                "Image is already browser readable",
              )
            ) {
              console.log(
                "[PreviewDialog] Fallback: HEIC error indicates image was already readable. Using original blob for preview.",
              );
              const objectUrl = URL.createObjectURL(originalHeicBlob);
              setImageUrl(objectUrl);
            } else {
              console.warn(
                "[PreviewDialog] Fallback: True HEIC conversion error. Preview may not be available.",
              );
              setImageUrl(null); // Or set a placeholder/error image URL
            }
          }
        })();
      } else {
        // For other image types
        const blob = new Blob([fileContent], { type: fileType });
        const objectUrl = URL.createObjectURL(blob);
        setImageUrl(objectUrl);
      }
    } else if (fileType.startsWith("video/")) {
      const blob = new Blob([fileContent], { type: fileType });
      const objectUrl = URL.createObjectURL(blob);
      setVideoUrl(objectUrl);
    } else if (fileType.startsWith("audio/")) {
      const blob = new Blob([fileContent], { type: fileType });
      const objectUrl = URL.createObjectURL(blob);
      setAudioUrl(objectUrl);
    } else if (fileType === "text/plain" || fileType === "text/markdown") {
      const decoder = new TextDecoder();
      setTextString(decoder.decode(fileContent));
    } else if (fileType === "application/pdf" && fileContent) {
      const blob = new Blob([fileContent], { type: "application/pdf" });
      const newUrl = URL.createObjectURL(blob);
      setPdfObjectUrl(newUrl);
      pdfObjectUrlRef.current = newUrl;
    }

    return () => {
      // This cleanup runs when dependencies change or component unmounts
      if (imageUrl && imageUrl.startsWith("blob:")) {
        URL.revokeObjectURL(imageUrl);
      }
      if (videoUrl && videoUrl.startsWith("blob:")) {
        URL.revokeObjectURL(videoUrl);
      }
      if (audioUrl && audioUrl.startsWith("blob:")) {
        URL.revokeObjectURL(audioUrl);
      }
      if (pdfObjectUrlRef.current) {
        URL.revokeObjectURL(pdfObjectUrlRef.current);
        pdfObjectUrlRef.current = null;
      }
      // Reset states as part of cleanup too, ensuring a clean slate for next preview
      setImageUrl(null);
      setVideoUrl(null);
      setAudioUrl(null);
      setTextString(null); // Not an object URL, but good to reset
      setPdfObjectUrl(null);
      // numPdfPages and pdfPageNumber are reset at the start of the effect
    };
  }, [fileContent, fileType, isOpen]);

  // Removed the second useEffect that was solely for pdfObjectUrlRef cleanup,
  // as its logic is now integrated into the main useEffect's cleanup.

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPdfPages(numPages);
    setPdfPageNumber(1); // Reset to first page on new document load
  };

  const renderContent = () => {
    // At the beginning of renderContent or just before the main if/else chain for types
    if (fileContent && fileType === "application/pdf") {
      console.log(
        "[PreviewDialog] Entry - fileContent.byteLength:",
        fileContent.byteLength,
      );
      try {
        const sliceTestAtEntry = fileContent.slice(0);
        console.log(
          "[PreviewDialog] Entry - fileContent slice test successful, new buffer byteLength:",
          sliceTestAtEntry.byteLength,
        );
      } catch (e) {
        console.error(
          "[PreviewDialog] Entry - Error trying to slice fileContent upon receiving in dialog:",
          e,
        );
      }
    }

    if (!fileContent) {
      return (
        <div className="flex justify-center items-center h-64">
          <Spinner className="h-12 w-12" />
        </div>
      );
    }

    if (fileType.startsWith("image/") && imageUrl) {
      const imageStyle: React.CSSProperties = {
        transform: `scale(${scale}) translate(${position.x}px, ${position.y}px)`,
        cursor: scale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default',
        transition: 'transform 0.15s ease-out', // Matches Tailwind class duration-150
      };

      if (scale === 1) {
        imageStyle.width = '100%';
        imageStyle.height = '100%';
        // object-contain will use these to fit the image within the container
      } else {
        // When zoomed, allow the image's scaled dimensions to be its natural size * scale
        imageStyle.maxWidth = 'none';
        imageStyle.maxHeight = 'none';
      }

      return (
        <div
          ref={imageContainerRef}
          className="w-full h-full overflow-hidden" // Removed cursor-grab from here, it's on imageStyle
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp} // Stop dragging if mouse leaves container
        >
          <img
            ref={imageRef}
            src={imageUrl}
            alt={fileName}
            className="object-contain" // Removed transition-transform, it's in style now
            style={imageStyle}
            draggable="false"
          />
        </div>
      );
    }

    if (fileType === "text/plain" && textString !== null) {
      return (
        <pre className="whitespace-pre-wrap break-all h-full overflow-auto p-4 bg-muted">
          {textString}
        </pre>
      );
    }

    if (fileType === "text/markdown" && textString !== null) {
      // For this subtask, assuming marked's default sanitization is sufficient.
      // In a production app, consider a more robust HTML sanitizer like DOMPurify if markdown source is untrusted.
      const rawMarkup = marked.parse(textString);
      return (
        <div
          dangerouslySetInnerHTML={{ __html: rawMarkup }}
          className="prose dark:prose-invert h-full overflow-auto p-4"
        />
      );
    }

    if (fileType === "application/pdf") {
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

      console.log(
        "FilePreviewDialog: Attempting to render PDF using object URL:",
        pdfObjectUrl,
      );

      return (
        <div className="w-full h-full flex flex-col items-center overflow-auto">
          <Document
            file={pdfObjectUrl} // Use the object URL from state
            onLoadSuccess={onDocumentLoadSuccess}
            onLoadError={(error) => {
              console.error("PDF load error:", error);
              // Consider displaying a more user-friendly error message in the UI here
              return (
                <p>
                  Error loading PDF file. It may be corrupted or unsupported.
                </p>
              );
            }}
            loading={<Spinner className="h-8 w-8 my-4" />}
            className="max-w-full"
          >
            <Page
              pageNumber={pdfPageNumber}
              renderTextLayer={true}
              renderAnnotationLayer={true}
              // width={window.innerWidth} // Removed to allow scale to dictate size
              scale={scale} // Apply zoom scale
            />
          </Document>
          {numPdfPages && (
            <div className="flex items-center gap-2 mt-2">
              <button
                onClick={() =>
                  setPdfPageNumber((prev) => Math.max(1, prev - 1))
                }
                disabled={pdfPageNumber <= 1}
                className="px-2 py-1 border rounded disabled:opacity-50"
              >
                Prev
              </button>
              <span>
                Page {pdfPageNumber} of {numPdfPages}
              </span>
              <button
                onClick={() =>
                  setPdfPageNumber((prev) => Math.min(numPdfPages, prev + 1))
                }
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

    if (fileType.startsWith("video/") && videoUrl) {
      return (
        <video
          controls
          src={videoUrl}
          className="w-full h-full object-contain"
        />
      );
    }

    if (fileType.startsWith("audio/") && audioUrl) {
      return <audio controls src={audioUrl} className="w-full mt-4" />;
    }

    return <p>Preview not available for this file type: {fileType}</p>;
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-screen h-screen max-w-screen max-h-screen p-4 flex flex-col">
        <DialogHeader>
          <DialogTitle className="truncate pr-6">{fileName}</DialogTitle>
          {/* <DialogDescription>Type: {fileType}</DialogDescription> */}
        </DialogHeader>
        <div className="flex-grow overflow-auto relative"> {/* Added relative for positioning zoom controls */}
          {renderContent()}
          {/* Zoom Controls */}
          {(fileType.startsWith('image/') && imageUrl) || (fileType === 'application/pdf' && pdfObjectUrl) ? (
            <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-50 bg-background/70 backdrop-blur-sm p-2 rounded-lg shadow-lg flex items-center gap-1">
              <Button variant="ghost" size="icon" onClick={handleZoomOut} aria-label="Zoom out">
                <ZoomOut className="h-5 w-5" />
              </Button>
              <span className="text-sm text-foreground min-w-[45px] text-center tabular-nums">
                {Math.round(scale * 100)}%
              </span>
              <Button variant="ghost" size="icon" onClick={handleZoomIn} aria-label="Zoom in">
                <ZoomIn className="h-5 w-5" />
              </Button>
              <Button variant="ghost" size="icon" onClick={handleZoomReset} aria-label="Reset zoom">
                <RefreshCcw className="h-5 w-5" />
              </Button>
            </div>
          ) : null}
        </div>
        <DialogFooter>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-primary text-primary-foreground rounded"
          >
            Close
          </button>
        </DialogFooter>
        {/* Navigation Arrows */}
        {onPrevious && canNavigatePrevious && (
          <button
            onClick={onPrevious}
            disabled={!canNavigatePrevious}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-50 p-2 bg-black/30 hover:bg-black/50 text-white rounded-full disabled:opacity-50 disabled:pointer-events-none transition-opacity"
            aria-label="Previous file"
          >
            <ChevronLeft size={32} />
          </button>
        )}
        {onNext && canNavigateNext && (
          <button
            onClick={onNext}
            disabled={!canNavigateNext}
            className="absolute right-4 top-1/2 -translate-y-1/2 z-50 p-2 bg-black/30 hover:bg-black/50 text-white rounded-full disabled:opacity-50 disabled:pointer-events-none transition-opacity"
            aria-label="Next file"
          >
            <ChevronRight size={32} />
          </button>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default FilePreviewDialog;

import heic2any from 'heic2any';
import * as pdfjsLib from 'pdfjs-dist';

// It's crucial that pdfjsLib.GlobalWorkerOptions.workerSrc is set globally,
// typically in the main application entry point (e.g., main.tsx or App.tsx),
// as FilePreviewDialog.tsx also depends on it.
// Example (if not already done elsewhere):
// import pdfWorkerEntryPoint from 'pdfjs-dist/build/pdf.worker.min.mjs?worker&url';
// pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerEntryPoint;

export async function generateImageThumbnail(
  file: File, // This is a browser File object, created from the decrypted blob in FileItem.tsx
  maxWidth: number,
  maxHeight: number,
  mimeType: string = 'image/jpeg', // Note: generateImageThumbnail itself uses file.type for HEIC/PDF detection
                                  // This mimeType param is for the *output* of canvas.toBlob for general images.
  quality: number = 0.8
): Promise<Blob | null> {
  return new Promise(async (resolve) => { // Removed 'reject' as we resolve with null on error
    // Handle HEIC/HEIF conversion first
    if (file.type === 'image/heic' || file.type === 'image/heif') {
      try {
        // console.log('[imageUtils] Attempting HEIC/HEIF conversion for:', file.name, 'Original file type:', file.type);
        const conversionResult = await heic2any({
          blob: file,
          toType: 'image/jpeg',
          quality: 0.9,
        });

        const convertedBlob = Array.isArray(conversionResult) ? conversionResult[0] : conversionResult;
        // console.log('[imageUtils] HEIC/HEIF conversion successful for:', file.name, '. Converted blob size:', convertedBlob.size, 'type:', convertedBlob.type);

        file = new File([convertedBlob], file.name, { type: 'image/jpeg' });
      } catch (conversionError: any) {
        if (conversionError && typeof conversionError.message === 'string' &&
            conversionError.message.includes('Image is already browser readable')) {
          // console.warn(`[imageUtils] HEIC conversion for '${file.name}' skipped: ${conversionError.message}. Using original file for thumbnailing.`);
          // The 'file' variable remains the original file. It will be processed by subsequent logic.
        } else {
          console.error('[imageUtils] HEIC to JPEG conversion failed for thumbnail. Error name:', (conversionError as Error)?.name);
          console.error('[imageUtils] HEIC to JPEG conversion failed for thumbnail. Error message:', (conversionError as Error)?.message);
          console.error('[imageUtils] HEIC to JPEG conversion failed for thumbnail. Error stack:', (conversionError as Error)?.stack);
          console.error('[imageUtils] HEIC to JPEG conversion failed for thumbnail. Full error (stringified):', String(conversionError));
          console.error('[imageUtils] HEIC to JPEG conversion failed for thumbnail. Full error (raw object):', conversionError);
          resolve(null);
          return;
        }
      }
    } else if (file.type === 'application/pdf') {
      // console.log('[imageUtils] Attempting PDF thumbnail generation for:', file.name);
      try {
        const pdfDataSource = { data: await file.arrayBuffer() };
        const pdfDoc = await pdfjsLib.getDocument(pdfDataSource).promise;
        const pdfPage = await pdfDoc.getPage(1); // Get the first page

        const viewport = pdfPage.getViewport({ scale: 1 }); // Get viewport at scale 1
        const scaleToFit = Math.min(maxWidth / viewport.width, maxHeight / viewport.height);
        const effectiveScale = (scaleToFit > 1) ? Math.min(scaleToFit, 3) : scaleToFit; // Cap upscaling at 3x, allow downscaling.
        const scaledViewport = pdfPage.getViewport({ scale: effectiveScale });

        const canvas = document.createElement('canvas');
        canvas.width = scaledViewport.width;
        canvas.height = scaledViewport.height;
        const context = canvas.getContext('2d');

        if (!context) {
          console.error('[imageUtils] PDF: Failed to get canvas context.');
          resolve(null);
          return;
        }

        // Fill background for PDFs with transparency (optional, white is common)
        context.fillStyle = 'white';
        context.fillRect(0, 0, canvas.width, canvas.height);

        await pdfPage.render({ canvasContext: context, viewport: scaledViewport }).promise;

        canvas.toBlob(
          (blob) => {
            if (blob) {
              // console.log('[imageUtils] PDF thumbnail generated for:', file.name, 'Blob size:', blob.size);
              resolve(blob);
            } else {
              console.error('[imageUtils] PDF: Canvas toBlob returned null.');
              resolve(null);
            }
          },
          'image/jpeg', // Output PDF thumbnail as JPEG
          quality // Use quality param (0.8 default)
        );
        return;
      } catch (pdfError) {
        console.error('[imageUtils] PDF thumbnail generation failed for:', file.name, pdfError);
        resolve(null);
        return;
      }
    }

    // Ensure the file is an image type for the generic image processing
    // This check is now more crucial if HEIC/PDF processing above modified 'file' or passed through.
    if (!file.type.startsWith('image/')) {
      // console.warn('[imageUtils] File is not a processable image type for generic thumbnailer:', file.name, file.type);
      resolve(null);
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round(height * (maxWidth / width));
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round(width * (maxHeight / height));
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          console.error('[imageUtils] Failed to get canvas context for generic image thumbnail.');
          resolve(null);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              console.error('[imageUtils] Canvas toBlob returned null for generic image.');
              resolve(null);
            }
          },
          mimeType, // Use the desired output mimeType (e.g. 'image/jpeg' if original was PNG)
          quality
        );
      };
      img.onerror = (error) => {
        console.error('[imageUtils] Image load error for generic image thumbnail:', error, 'File name:', file.name);
        resolve(null);
      };

      if (event.target?.result && typeof event.target.result === 'string') {
        img.src = event.target.result;
      } else {
        console.error('[imageUtils] FileReader did not return a valid string result for generic image source.');
        resolve(null);
      }
    };
    reader.onerror = (error) => {
      console.error('[imageUtils] FileReader error for generic image thumbnail:', error);
      resolve(null);
    };

    reader.readAsDataURL(file); // Read the (potentially converted) file
  });
}

import heic2any from "heic2any";
import * as pdfjsLib from "pdfjs-dist";

// Ensure pdfjsLib.GlobalWorkerOptions.workerSrc is set globally
// (e.g., in main.tsx or App.tsx) for PDF.js to function correctly.
// Example:
// import pdfWorkerEntryPoint from 'pdfjs-dist/build/pdf.worker.min.mjs?worker&url';
// pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerEntryPoint;

export async function generateImageThumbnail(
  file: File, // Browser File object
  maxWidth: number,
  maxHeight: number,
  mimeType: string = "image/jpeg", // Default output mimeType for general images
  quality: number = 0.8
): Promise<Blob | null> {
  return new Promise(async (resolve) => {
    if (file.type === "image/heic" || file.type === "image/heif") {
      try {
        const conversionResult = await heic2any({
          blob: file,
          toType: "image/jpeg",
          quality: 0.9, // Quality for HEIC to JPEG conversion
        });
        const convertedBlob = Array.isArray(conversionResult)
          ? conversionResult[0]
          : conversionResult;
        file = new File([convertedBlob], file.name, { type: "image/jpeg" });
      } catch (conversionError: any) {
        if (
          conversionError &&
          typeof conversionError.message === "string" &&
          conversionError.message.includes("Image is already browser readable")
        ) {
          console.warn(
            `[imageUtils] HEIC conversion for '${file.name}' skipped: ${conversionError.message}. Using original file.`
          );
        } else {
          console.error(
            `[imageUtils] HEIC to JPEG conversion failed for thumbnail for file '${file.name}':`,
            conversionError
          );
          resolve(null);
          return;
        }
      }
    } else if (file.type === "application/pdf") {
      try {
        if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
          console.warn(
            "[imageUtils] PDF worker not configured. Attempting to set dynamically for Vite. Best to set this in main.tsx/App.tsx."
          );
          // This dynamic import is Vite-specific and a fallback.
          try {
            const pdfWorkerEntryPoint = (
              await import("pdfjs-dist/build/pdf.worker.min.mjs?worker&url")
            ).default;
            if (pdfWorkerEntryPoint) {
              pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerEntryPoint;
            } else {
              throw new Error(
                "Dynamic import of PDF worker failed to return a path."
              );
            }
          } catch (workerError) {
            console.error(
              "[imageUtils] Failed to dynamically set PDF worker source. PDF thumbnails may fail.",
              workerError
            );
            resolve(null); // Resolve with null if worker cannot be set.
            return;
          }
        }

        const pdfDataSource = { data: await file.arrayBuffer() };
        const pdfDoc = await pdfjsLib.getDocument(pdfDataSource).promise;
        const pdfPage = await pdfDoc.getPage(1); // Get the first page

        const viewport = pdfPage.getViewport({ scale: 1 });
        const scaleToFit = Math.min(
          maxWidth / viewport.width,
          maxHeight / viewport.height
        );
        const effectiveScale =
          scaleToFit > 1 ? Math.min(scaleToFit, 3) : scaleToFit;
        const scaledViewport = pdfPage.getViewport({ scale: effectiveScale });

        const canvas = document.createElement("canvas");
        canvas.width = scaledViewport.width;
        canvas.height = scaledViewport.height;
        const context = canvas.getContext("2d");

        if (!context) {
          console.error(
            "[imageUtils] PDF: Failed to get canvas context for file:",
            file.name
          );
          resolve(null);
          return;
        }

        context.fillStyle = "white";
        context.fillRect(0, 0, canvas.width, canvas.height);

        await pdfPage.render({
          canvasContext: context,
          viewport: scaledViewport,
        }).promise;

        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              console.error(
                "[imageUtils] PDF: Canvas toBlob returned null for file:",
                file.name
              );
              resolve(null);
            }
          },
          "image/jpeg",
          quality
        );
        return;
      } catch (pdfError) {
        console.error(
          `[imageUtils] PDF thumbnail generation failed for '${file.name}':`,
          pdfError
        );
        resolve(null);
        return;
      }
    }

    // Generic image processing (for types like image/jpeg, image/png directly, or HEIC after conversion)
    if (!file.type.startsWith("image/")) {
      // This path should ideally not be hit if FileItem.tsx only calls this for image/* and application/pdf
      console.warn(
        `[imageUtils] File '${file.name}' of type '${file.type}' is not a processable image type for generic thumbnailer.`
      );
      resolve(null);
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let { width, height } = img;

        // Calculate new dimensions while maintaining aspect ratio
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

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          console.error(
            "[imageUtils] Failed to get canvas context for generic image thumbnail for file:",
            file.name
          );
          resolve(null);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              console.error(
                "[imageUtils] Canvas toBlob returned null for generic image for file:",
                file.name
              );
              resolve(null);
            }
          },
          mimeType, // Output format (e.g., 'image/jpeg')
          quality // Output quality
        );
      };
      img.onerror = (error) => {
        console.error(
          `[imageUtils] Image load error for generic image thumbnail for file '${file.name}':`,
          error
        );
        resolve(null);
      };

      if (event.target?.result && typeof event.target.result === "string") {
        img.src = event.target.result;
      } else {
        console.error(
          "[imageUtils] FileReader did not return a valid string result for generic image source for file:",
          file.name
        );
        resolve(null);
      }
    };
    reader.onerror = (error) => {
      console.error(
        `[imageUtils] FileReader error for generic image thumbnail for file '${file.name}':`,
        error
      );
      resolve(null);
    };

    reader.readAsDataURL(file);
  });
}

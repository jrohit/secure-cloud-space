
import CryptoJS from "crypto-js";
import { v4 as uuidv4 } from "uuid";

const MAX_CHUNK_SIZE = 20 * 1024 * 1024; // 20MB chunks for file processing

export const encryptionService = {
  /**
   * Generates an encryption key based on user credentials
   * This is a deterministic way to create a key that only the user can recreate
   */
  generateUserEncryptionKey: (userId: string, token: string): string => {
    // Create a deterministic key based on user ID and auth token
    return CryptoJS.SHA256(userId + token).toString();
  },

  /**
   * Encrypts data with the user's encryption key
   */
  encryptData: (data: string, encryptionKey: string): string => {
    return CryptoJS.AES.encrypt(data, encryptionKey).toString();
  },

  /**
   * Decrypts data with the user's encryption key
   */
  decryptData: (encryptedData: string, encryptionKey: string): string => {
    try {
      const bytes = CryptoJS.AES.decrypt(encryptedData, encryptionKey);
      return bytes.toString(CryptoJS.enc.Utf8);
    } catch (error) {
      console.error("Failed to decrypt data:", error);
      return ""; // Return empty string on decryption failure
    }
  },

  /**
   * Encrypt file content using a web worker
   * This function processes files in chunks to avoid memory issues
   */
  encryptFile: async (
    file: Blob,
    encryptionKey: string,
    fileName?: string,
    onProgress?: (progress: number) => void
  ): Promise<{ 
    encryptedBlob: Blob;
    iv: string;
  }> => {
    // Create a worker
    const worker = new Worker(
      new URL("../../workers/encryption.worker.ts", import.meta.url),
      { type: "module" }
    );

    // Define chunk size based on file size
    const chunkSize = Math.min(
      file.size > 500 * 1024 * 1024
        ? 50 * 1024 * 1024  // 50MB chunks for very large files
        : file.size > 100 * 1024 * 1024
        ? 20 * 1024 * 1024  // 20MB chunks for large files
        : 10 * 1024 * 1024, // 10MB chunks for smaller files
      MAX_CHUNK_SIZE
    );

    const totalChunks = Math.ceil(file.size / chunkSize);
    let encryptedChunks: { data: string; iv: string }[] = new Array(totalChunks);
    let completedChunks = 0;
    let iv: string | null = null;

    return new Promise((resolve, reject) => {
      // Process worker responses
      worker.onmessage = (e) => {
        const { encrypted, iv: chunkIv, error, chunkIndex, totalChunks, type, progress } = e.data;

        if (type === "error" || error) {
          worker.terminate();
          reject(new Error(`Worker error: ${error}`));
          return;
        }

        if (type === "progress" && onProgress) {
          // Calculate overall progress based on chunk progress
          const chunkProgress = progress / 100;
          const overallProgress =
            (chunkIndex / totalChunks + chunkProgress / totalChunks) * 100;
          onProgress(Math.round(overallProgress));
          return;
        }

        if (type === "result") {
          // Store the encrypted chunk and IV (we'll use the same IV for all chunks)
          if (!iv) iv = chunkIv;
          
          encryptedChunks[chunkIndex] = {
            data: encrypted,
            iv: chunkIv
          };
          completedChunks++;

          if (onProgress) {
            onProgress(Math.round((completedChunks / totalChunks) * 100));
          }

          // Check if all chunks are processed
          if (completedChunks === totalChunks) {
            try {
              // Combine all encrypted chunks with their IVs to form our custom format
              const combinedEncrypted = encryptedChunks.map(chunk => 
                `${chunk.iv}|||IV_SEP|||${chunk.data}`
              ).join("|||CHUNK|||");

              // Terminate the worker
              worker.terminate();

              // Return the encrypted data as a blob and the IV
              resolve({
                encryptedBlob: new Blob([combinedEncrypted], { type: "application/encrypted" }),
                iv: iv || ""
              });
            } catch (err) {
              reject(new Error(`Error combining encrypted chunks: ${err}`));
            }
          }
        }
      };

      // Handle worker errors
      worker.onerror = (error) => {
        worker.terminate();
        reject(new Error(`Worker error: ${error.message}`));
      };

      // Send chunks to the worker for processing
      for (let i = 0; i < totalChunks; i++) {
        const start = i * chunkSize;
        const end = Math.min(start + chunkSize, file.size);
        const chunk = file.slice(start, end);

        worker.postMessage({
          action: "encrypt",
          data: {
            fileChunk: chunk,
            encryptionKey,
            chunkIndex: i,
            totalChunks,
            fileName: fileName || file.name || `file-${uuidv4()}`
          },
        });
      }
    });
  },

  /**
   * Decrypt file content using a web worker
   */
  decryptFile: async (
    encryptedBlob: Blob,
    encryptionKey: string,
    originalType: string,
    iv?: string,
    fileName?: string,
    onProgress?: (progress: number) => void
  ): Promise<Blob> => {
    // Create a worker
    const worker = new Worker(
      new URL("../../workers/encryption.worker.ts", import.meta.url),
      { type: "module" }
    );

    // Get the encrypted text
    const encryptedText = await encryptedBlob.text();

    // Check if we're using the new format with embedded IVs
    let encryptedChunks: { data: string; iv: string }[] = [];
    
    if (encryptedText.includes("|||IV_SEP|||")) {
      // New format with embedded IVs
      const chunks = encryptedText.split("|||CHUNK|||");
      
      encryptedChunks = chunks.map(chunk => {
        const [chunkIv, data] = chunk.split("|||IV_SEP|||");
        return { data, iv: chunkIv };
      });
    } else if (encryptedText.includes("|||CHUNK|||")) {
      // Old format without embedded IVs
      const chunks = encryptedText.split("|||CHUNK|||");
      
      if (!iv) {
        throw new Error("IV is required for decryption of legacy format");
      }
      
      encryptedChunks = chunks.map(chunk => ({
        data: chunk,
        iv
      }));
    } else {
      // Single chunk without |||CHUNK||| separator
      if (!iv) {
        throw new Error("IV is required for decryption of legacy format");
      }
      
      encryptedChunks = [{
        data: encryptedText,
        iv
      }];
    }
    
    const totalChunks = encryptedChunks.length;
    let decryptedChunks: ArrayBuffer[] = new Array(totalChunks);
    let completedChunks = 0;

    return new Promise((resolve, reject) => {
      // Process worker responses
      worker.onmessage = (e) => {
        const {
          decryptedData,
          error,
          chunkIndex,
          totalChunks,
          type,
          progress,
        } = e.data;

        if (type === "error" || error) {
          worker.terminate();
          reject(new Error(`Worker error: ${error}`));
          return;
        }

        if (type === "progress" && onProgress) {
          // Calculate overall progress based on chunk progress
          const chunkProgress = progress / 100;
          const overallProgress =
            (chunkIndex / totalChunks + chunkProgress / totalChunks) * 100;
          onProgress(Math.round(overallProgress));
          return;
        }

        if (type === "result") {
          // Store the decrypted chunk
          decryptedChunks[chunkIndex] = decryptedData;
          completedChunks++;

          if (onProgress) {
            onProgress(Math.round((completedChunks / totalChunks) * 100));
          }

          // Check if all chunks are processed
          if (completedChunks === totalChunks) {
            try {
              // Combine all decrypted chunks
              const combinedSize = decryptedChunks.reduce(
                (acc, chunk) => acc + chunk.byteLength,
                0
              );
              const combinedArray = new Uint8Array(combinedSize);

              let offset = 0;
              for (const chunk of decryptedChunks) {
                combinedArray.set(new Uint8Array(chunk), offset);
                offset += chunk.byteLength;
              }

              // Terminate the worker
              worker.terminate();

              // Return the decrypted data as a blob with the original type
              resolve(new Blob([combinedArray], { type: originalType }));
            } catch (error) {
              reject(new Error(`Error combining decrypted chunks: ${error}`));
            }
          }
        }
      };

      // Handle worker errors
      worker.onerror = (error) => {
        worker.terminate();
        reject(new Error(`Worker error: ${error.message}`));
      };

      // Send chunks to the worker for processing
      encryptedChunks.forEach((chunk, i) => {
        worker.postMessage({
          action: "decrypt",
          data: {
            encryptedText: chunk.data,
            iv: chunk.iv,
            encryptionKey,
            originalType,
            chunkIndex: i,
            totalChunks,
            fileName: fileName || `file-${i}`
          },
        });
      });
    });
  },

  /**
   * Generate a thumbnail for preview from an image or video file
   */
  generateThumbnail: async (file: Blob, maxWidth = 200, maxHeight = 200): Promise<Blob | null> => {
    if (!file) return null;
    
    const fileType = file.type;
    
    // Handle image files
    if (fileType.startsWith('image/')) {
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          
          // Calculate dimensions while maintaining aspect ratio
          if (width > height) {
            if (width > maxWidth) {
              height = Math.round(height * maxWidth / width);
              width = maxWidth;
            }
          } else {
            if (height > maxHeight) {
              width = Math.round(width * maxHeight / height);
              height = maxHeight;
            }
          }
          
          canvas.width = width;
          canvas.height = height;
          
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(null);
            return;
          }
          
          ctx.drawImage(img, 0, 0, width, height);
          
          // Convert canvas to blob
          canvas.toBlob((blob) => {
            resolve(blob);
          }, 'image/jpeg', 0.7); // Use JPEG for thumbnails with 70% quality
        };
        
        img.onerror = () => resolve(null);
        
        img.src = URL.createObjectURL(file);
      });
    }
    
    // For videos, we'd typically use ffmpeg, but that's not available in the browser
    // For now, return a placeholder or null
    if (fileType.startsWith('video/')) {
      // Placeholder implementation - in a real app, you might use a video frame capture library
      return null;
    }
    
    // For other file types, return null
    return null;
  }
};

import CryptoJS from "crypto-js";

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
    const bytes = CryptoJS.AES.decrypt(encryptedData, encryptionKey);
    return bytes.toString(CryptoJS.enc.Utf8);
  },

  /**
   * Encrypt file content using a web worker
   * This function processes files in chunks to avoid memory issues
   */
  encryptFile: async (file: Blob, encryptionKey: string): Promise<Blob> => {
    // Create a worker
    const worker = new Worker(
      new URL("../../workers/encryption.worker.ts", import.meta.url),
      { type: "module" }
    );

    const MB_1 = 1024 * 1024;
    // Define chunk size (1MB)
    const CHUNK_SIZE = 1 * MB_1;
    let totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    if (totalChunks > 500) {
      totalChunks = Math.ceil(file.size / (CHUNK_SIZE * 50));
    }
    let encryptedChunks: Uint8Array[] = new Array(totalChunks);
    let completedChunks = 0;

    return new Promise((resolve, reject) => {
      // Process worker responses
      worker.onmessage = (e) => {
        const { encrypted, error, chunkIndex, totalChunks } = e.data;

        if (error) {
          worker.terminate();
          reject(new Error(`Worker error: ${error}`));
          return;
        }

        // Store the encrypted chunk
        // encryptedChunks[chunkIndex] = encrypted;
        encryptedChunks[chunkIndex] = new Uint8Array(encrypted);
        completedChunks++;

        // Check if all chunks are processed
        if (completedChunks === totalChunks) {
          const finalBlob = new Blob(encryptedChunks, {
            type: "application/encrypted",
          });
          // Combine all encrypted chunks
          // const combinedEncrypted = encryptedChunks.join("|||CHUNK|||");

          // Terminate the worker
          worker.terminate();

          resolve(finalBlob);
          // Return the encrypted data as a blob
          // resolve(
          //   new Blob([combinedEncrypted], { type: "application/encrypted" })
          // );
        }
      };

      // Handle worker errors
      worker.onerror = (error) => {
        debugger;
        worker.terminate();
        reject(new Error(`Worker error: ${error.message}`));
      };

      // Send chunks to the worker for processing
      for (let i = 0; i < totalChunks; i++) {
        debugger;
        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, file.size);
        const chunk = file.slice(start, end);

        worker.postMessage({
          action: "encrypt",
          data: {
            fileChunk: chunk,
            encryptionKey,
            chunkIndex: i,
            totalChunks,
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
    originalType: string
  ): Promise<Blob> => {
    // Create a worker
    const worker = new Worker(
      new URL("../../workers/encryption.worker.ts", import.meta.url),
      { type: "module" }
    );

    // Get the encrypted text
    const encryptedText = await encryptedBlob.text();

    // Split into chunks if it was chunked during encryption
    const encryptedChunks = encryptedText.split("|||CHUNK|||");
    const totalChunks = encryptedChunks.length;
    let decryptedChunks: string[] = new Array(totalChunks);
    let completedChunks = 0;

    return new Promise((resolve, reject) => {
      // Process worker responses
      worker.onmessage = (e) => {
        const { decrypted, error, chunkIndex, totalChunks } = e.data;

        if (error) {
          worker.terminate();
          reject(new Error(`Worker error: ${error}`));
          return;
        }

        // Store the decrypted chunk
        decryptedChunks[chunkIndex] = decrypted;
        completedChunks++;

        // Check if all chunks are processed
        if (completedChunks === totalChunks) {
          // Combine all decrypted chunks
          const combinedDecrypted = decryptedChunks.join("");

          // Terminate the worker
          worker.terminate();

          // Return the decrypted data as a blob with the original type
          resolve(new Blob([combinedDecrypted], { type: originalType }));
        }
      };

      // Handle worker errors
      worker.onerror = (error) => {
        worker.terminate();
        reject(new Error(`Worker error: ${error.message}`));
      };

      // Send chunks to the worker for processing
      for (let i = 0; i < totalChunks; i++) {
        worker.postMessage({
          action: "decrypt",
          data: {
            encryptedText: encryptedChunks[i],
            encryptionKey,
            originalType,
            chunkIndex: i,
            totalChunks,
          },
        });
      }
    });
  },
};


import CryptoJS from 'crypto-js';

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
  encryptFile: async (file: Blob, encryptionKey: string, onProgress?: (progress: number) => void): Promise<Blob> => {
    // Create a worker
    const worker = new Worker(new URL('../../workers/encryption.worker.ts', import.meta.url), { type: 'module' });
    
    // Define chunk size (5MB for large files, smaller for small files)
    const CHUNK_SIZE = file.size > 100 * 1024 * 1024 ? 5 * 1024 * 1024 : 10 * 1024 * 1024;
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    let encryptedChunks: string[] = new Array(totalChunks);
    let completedChunks = 0;
    
    return new Promise((resolve, reject) => {
      // Process worker responses
      worker.onmessage = (e) => {
        const { encrypted, error, chunkIndex, totalChunks, type, progress } = e.data;
        
        if (type === 'error' || error) {
          worker.terminate();
          reject(new Error(`Worker error: ${error}`));
          return;
        }
        
        if (type === 'progress' && onProgress) {
          // Calculate overall progress based on chunk progress
          const chunkProgress = progress / 100;
          const overallProgress = ((chunkIndex / totalChunks) + (chunkProgress / totalChunks)) * 100;
          onProgress(Math.round(overallProgress));
          return;
        }
        
        if (type === 'result') {
          // Store the encrypted chunk
          encryptedChunks[chunkIndex] = encrypted;
          completedChunks++;
          
          if (onProgress) {
            onProgress(Math.round((completedChunks / totalChunks) * 100));
          }
          
          // Check if all chunks are processed
          if (completedChunks === totalChunks) {
            // Combine all encrypted chunks
            const combinedEncrypted = encryptedChunks.join('|||CHUNK|||');
            
            // Terminate the worker
            worker.terminate();
            
            // Return the encrypted data as a blob
            resolve(new Blob([combinedEncrypted], { type: 'application/encrypted' }));
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
        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, file.size);
        const chunk = file.slice(start, end);
        
        worker.postMessage({
          action: 'encrypt',
          data: {
            fileChunk: chunk,
            encryptionKey,
            chunkIndex: i,
            totalChunks
          }
        });
      }
    });
  },
  
  /**
   * Decrypt file content using a web worker
   */
  decryptFile: async (encryptedBlob: Blob, encryptionKey: string, originalType: string, onProgress?: (progress: number) => void): Promise<Blob> => {
    // Create a worker
    const worker = new Worker(new URL('../../workers/encryption.worker.ts', import.meta.url), { type: 'module' });
    
    // Get the encrypted text
    const encryptedText = await encryptedBlob.text();
    
    // Split into chunks if it was chunked during encryption
    const encryptedChunks = encryptedText.split('|||CHUNK|||');
    const totalChunks = encryptedChunks.length;
    let decryptedChunks: ArrayBuffer[] = new Array(totalChunks);
    let completedChunks = 0;
    
    return new Promise((resolve, reject) => {
      // Process worker responses
      worker.onmessage = (e) => {
        const { decryptedData, error, chunkIndex, totalChunks, type, progress } = e.data;
        
        if (type === 'error' || error) {
          worker.terminate();
          reject(new Error(`Worker error: ${error}`));
          return;
        }
        
        if (type === 'progress' && onProgress) {
          // Calculate overall progress based on chunk progress
          const chunkProgress = progress / 100;
          const overallProgress = ((chunkIndex / totalChunks) + (chunkProgress / totalChunks)) * 100;
          onProgress(Math.round(overallProgress));
          return;
        }
        
        if (type === 'result') {
          // Store the decrypted chunk
          decryptedChunks[chunkIndex] = decryptedData;
          completedChunks++;
          
          if (onProgress) {
            onProgress(Math.round((completedChunks / totalChunks) * 100));
          }
          
          // Check if all chunks are processed
          if (completedChunks === totalChunks) {
            // Combine all decrypted chunks
            const combinedSize = decryptedChunks.reduce((acc, chunk) => acc + chunk.byteLength, 0);
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
        worker.postMessage({
          action: 'decrypt',
          data: {
            encryptedText: encryptedChunks[i],
            encryptionKey,
            originalType,
            chunkIndex: i,
            totalChunks
          }
        });
      }
    });
  }
};

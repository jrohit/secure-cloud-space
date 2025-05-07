
import { v4 as uuidv4 } from "uuid";

const MAX_CHUNK_SIZE = 20 * 1024 * 1024; // 20MB chunks for file processing

export const encryptionService = {
  /**
   * Generates an encryption key based on user credentials
   */
  generateUserEncryptionKey: async (userId: string, token: string): Promise<CryptoKey> => {
    // Create a deterministic key based on user ID and auth token
    const encoder = new TextEncoder();
    const data = encoder.encode(userId + token);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    
    // Import the hash as a CryptoKey
    return crypto.subtle.importKey(
      'raw',
      hashBuffer,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  },
  
  /**
   * Convert CryptoKey to base64 string
   */
  cryptoKeyToString: async (key: CryptoKey): Promise<string> => {
    const exported = await crypto.subtle.exportKey('raw', key);
    return btoa(String.fromCharCode(...new Uint8Array(exported)));
  },
  
  /**
   * Convert base64 string to CryptoKey
   */
  stringToCryptoKey: async (keyString: string): Promise<CryptoKey> => {
    const binaryString = atob(keyString);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    return crypto.subtle.importKey(
      'raw',
      bytes.buffer,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  },

  /**
   * Encrypt data using Web Crypto API
   */
  encryptData: async (data: string, encryptionKey: CryptoKey | string): Promise<{
    encrypted: string;
    iv: string;
  }> => {
    // Convert string key to CryptoKey if needed
    let key = encryptionKey;
    if (typeof encryptionKey === 'string') {
      key = await encryptionService.stringToCryptoKey(encryptionKey);
    }
    
    // Generate random IV
    const iv = crypto.getRandomValues(new Uint8Array(12));
    
    // Encrypt the data
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    
    const encryptedBuffer = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv
      },
      key as CryptoKey,
      dataBuffer
    );
    
    // Convert to base64 strings
    const encryptedBase64 = btoa(String.fromCharCode(...new Uint8Array(encryptedBuffer)));
    const ivBase64 = btoa(String.fromCharCode(...iv));
    
    return {
      encrypted: encryptedBase64,
      iv: ivBase64
    };
  },

  /**
   * Decrypt data using Web Crypto API
   */
  decryptData: async (encryptedData: string, iv: string, encryptionKey: CryptoKey | string): Promise<string> => {
    try {
      // Convert string key to CryptoKey if needed
      let key = encryptionKey;
      if (typeof encryptionKey === 'string') {
        key = await encryptionService.stringToCryptoKey(encryptionKey);
      }
      
      // Decode base64 strings
      const encryptedBuffer = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0)).buffer;
      const ivBuffer = Uint8Array.from(atob(iv), c => c.charCodeAt(0));
      
      // Decrypt the data
      const decryptedBuffer = await crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: ivBuffer
        },
        key as CryptoKey,
        encryptedBuffer
      );
      
      // Convert buffer to string
      const decoder = new TextDecoder();
      return decoder.decode(decryptedBuffer);
    } catch (error) {
      console.error("Failed to decrypt data:", error);
      throw new Error("Decryption failed");
    }
  },

  /**
   * Encrypt file content using Web Crypto API with chunking
   */
  encryptFile: async (
    file: Blob,
    encryptionKey: string | CryptoKey,
    onProgress?: (progress: number) => void
  ): Promise<{ 
    encryptedBlob: Blob;
    iv: string;
  }> => {
    // Convert string key to CryptoKey if needed
    let key = encryptionKey;
    if (typeof encryptionKey === 'string') {
      key = await encryptionService.stringToCryptoKey(encryptionKey);
    }
    
    // Generate random IV
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ivBase64 = btoa(String.fromCharCode(...iv));
    
    // Process file in chunks to avoid memory issues
    const chunkSize = Math.min(MAX_CHUNK_SIZE, file.size);
    const chunksCount = Math.ceil(file.size / chunkSize);
    const encryptedChunks: Blob[] = [];
    
    for (let i = 0; i < chunksCount; i++) {
      const start = i * chunkSize;
      const end = Math.min(start + chunkSize, file.size);
      const chunk = file.slice(start, end);
      
      // Read chunk as ArrayBuffer
      const chunkBuffer = await chunk.arrayBuffer();
      
      // Encrypt chunk using AES-GCM
      const encryptedBuffer = await crypto.subtle.encrypt(
        {
          name: 'AES-GCM',
          iv: iv
        },
        key as CryptoKey,
        chunkBuffer
      );
      
      // Convert to blob and add to chunks array
      encryptedChunks.push(new Blob([encryptedBuffer]));
      
      // Report progress
      if (onProgress) {
        onProgress((i + 1) / chunksCount * 100);
      }
    }
    
    // Combine all chunks into a single blob
    const encryptedBlob = new Blob(encryptedChunks, { type: 'application/encrypted' });
    
    return {
      encryptedBlob,
      iv: ivBase64
    };
  },

  /**
   * Decrypt file content using Web Crypto API with chunking
   */
  decryptFile: async (
    encryptedBlob: Blob,
    iv: string,
    encryptionKey: string | CryptoKey,
    originalType: string,
    onProgress?: (progress: number) => void
  ): Promise<Blob> => {
    // Convert string key to CryptoKey if needed
    let key = encryptionKey;
    if (typeof encryptionKey === 'string') {
      key = await encryptionService.stringToCryptoKey(encryptionKey);
    }
    
    // Decode IV from base64
    const ivArray = Uint8Array.from(atob(iv), c => c.charCodeAt(0));
    
    // Process file in chunks if it's large
    const chunkSize = Math.min(MAX_CHUNK_SIZE, encryptedBlob.size);
    const chunksCount = Math.ceil(encryptedBlob.size / chunkSize);
    const decryptedChunks: Blob[] = [];
    
    for (let i = 0; i < chunksCount; i++) {
      const start = i * chunkSize;
      const end = Math.min(start + chunkSize, encryptedBlob.size);
      const chunk = encryptedBlob.slice(start, end);
      
      // Read chunk as ArrayBuffer
      const chunkBuffer = await chunk.arrayBuffer();
      
      try {
        // Decrypt chunk using AES-GCM
        const decryptedBuffer = await crypto.subtle.decrypt(
          {
            name: 'AES-GCM',
            iv: ivArray
          },
          key as CryptoKey,
          chunkBuffer
        );
        
        // Convert to blob and add to chunks array
        decryptedChunks.push(new Blob([decryptedBuffer]));
        
        // Report progress
        if (onProgress) {
          onProgress((i + 1) / chunksCount * 100);
        }
      } catch (error) {
        console.error(`Error decrypting chunk ${i}:`, error);
        throw new Error(`Failed to decrypt file: ${error}`);
      }
    }
    
    // Combine all chunks into a single blob with original type
    return new Blob(decryptedChunks, { type: originalType || 'application/octet-stream' });
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

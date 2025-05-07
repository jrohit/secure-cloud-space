
// Web worker for file encryption/decryption

// Size for processing chunks (in bytes)
const CHUNK_PROCESSING_SIZE = 4 * 1024 * 1024; // 4MB chunks for processing
const MAX_MEMORY_USAGE = 1024 * 1024 * 1024; // 1GB maximum memory usage

// Handle messages from the main thread
self.addEventListener('message', async (event) => {
  const { action, data } = event.data;
  
  switch (action) {
    case 'encrypt':
      await handleEncryption(data);
      break;
      
    case 'decrypt':
      await handleDecryption(data);
      break;
      
    default:
      self.postMessage({ error: `Unknown action: ${action}`, type: 'error' });
  }
});

async function handleEncryption(data) {
  try {
    const { fileChunk, encryptionKey, chunkIndex, totalChunks, fileName } = data;
    
    // Read the chunk as ArrayBuffer
    const arrayBuffer = await fileChunk.arrayBuffer();
    
    // Import encryption key
    const key = await importKey(encryptionKey);
    
    // Generate a random IV for this chunk
    const iv = crypto.getRandomValues(new Uint8Array(12));
    
    // Process the chunk in smaller pieces to prevent memory issues
    const totalSize = arrayBuffer.byteLength;
    let encryptedChunks = [];
    
    // Process the chunk in smaller pieces
    for (let offset = 0; offset < totalSize; offset += CHUNK_PROCESSING_SIZE) {
      const size = Math.min(CHUNK_PROCESSING_SIZE, totalSize - offset);
      const slice = new Uint8Array(arrayBuffer, offset, size);
      
      // Encrypt this piece
      const encryptedBuffer = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        slice
      );
      
      encryptedChunks.push(encryptedBuffer);
      
      // Report progress for large files
      if (totalSize > CHUNK_PROCESSING_SIZE * 10) {
        const processedPercent = Math.round((offset + size) / totalSize * 100);
        self.postMessage({
          progress: processedPercent,
          chunkIndex,
          totalChunks,
          fileName,
          type: 'progress'
        });
      }
      
      // Allow garbage collection to prevent memory issues
      await new Promise(resolve => setTimeout(resolve, 0));
    }
    
    // Combine all encrypted pieces into one array buffer
    const totalLength = encryptedChunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
    const result = new Uint8Array(totalLength);
    
    let offset = 0;
    for (const chunk of encryptedChunks) {
      result.set(new Uint8Array(chunk), offset);
      offset += chunk.byteLength;
    }
    
    // Convert IV to string for passing back to main thread
    const ivString = arrayBufferToBase64(iv);
    
    // Send the encrypted data with IV back
    self.postMessage({
      encrypted: result.buffer,
      iv: ivString,
      chunkIndex,
      totalChunks,
      fileName,
      error: null,
      type: 'result'
    }, [result.buffer]);
  } catch (error) {
    self.postMessage({ 
      error: `Encryption error: ${error.message || error}`, 
      chunkIndex: data.chunkIndex,
      fileName: data.fileName,
      type: 'error' 
    });
  }
}

async function handleDecryption(data) {
  try {
    const { encryptedData, iv, encryptionKey, originalType, chunkIndex, totalChunks, fileName } = data;
    
    // Import encryption key
    const key = await importKey(encryptionKey);
    
    // Decode IV from base64
    const ivArray = base64ToArrayBuffer(iv);
    
    // Process in chunks if the encrypted data is large
    const totalSize = encryptedData.byteLength;
    let decryptedChunks = [];
    
    // Process the data in smaller pieces
    for (let offset = 0; offset < totalSize; offset += CHUNK_PROCESSING_SIZE) {
      const size = Math.min(CHUNK_PROCESSING_SIZE, totalSize - offset);
      const slice = new Uint8Array(encryptedData, offset, size);
      
      try {
        // Decrypt this piece
        const decryptedBuffer = await crypto.subtle.decrypt(
          { name: 'AES-GCM', iv: ivArray },
          key,
          slice
        );
        
        decryptedChunks.push(decryptedBuffer);
        
        // Report progress for large files
        if (totalSize > CHUNK_PROCESSING_SIZE * 10) {
          const processedPercent = Math.round((offset + size) / totalSize * 100);
          self.postMessage({
            progress: processedPercent,
            chunkIndex,
            totalChunks,
            fileName,
            type: 'progress'
          });
        }
      } catch (error) {
        throw new Error(`Failed to decrypt piece at offset ${offset}: ${error.message}`);
      }
      
      // Allow garbage collection to prevent memory issues
      await new Promise(resolve => setTimeout(resolve, 0));
    }
    
    // Combine all decrypted pieces into one array buffer
    const totalLength = decryptedChunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
    const result = new Uint8Array(totalLength);
    
    let offset = 0;
    for (const chunk of decryptedChunks) {
      result.set(new Uint8Array(chunk), offset);
      offset += chunk.byteLength;
    }
    
    // Send the decrypted data back with proper transfer option
    self.postMessage({
      decryptedData: result.buffer,
      originalType,
      chunkIndex,
      totalChunks,
      fileName,
      type: 'result'
    }, [result.buffer]);
  } catch (error) {
    self.postMessage({ 
      error: `Decryption error: ${error.message || error}`, 
      chunkIndex: data.chunkIndex,
      fileName: data.fileName,
      type: 'error' 
    });
  }
}

// Helper function to convert string key to CryptoKey
async function importKey(keyString) {
  if (keyString instanceof CryptoKey) {
    return keyString;
  }
  
  try {
    const keyData = base64ToArrayBuffer(keyString);
    return await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'AES-GCM' },
      false,
      ['encrypt', 'decrypt']
    );
  } catch (error) {
    // Try to handle key as a raw string that needs hashing
    const encoder = new TextEncoder();
    const keyData = encoder.encode(keyString);
    const hashBuffer = await crypto.subtle.digest('SHA-256', keyData);
    
    return crypto.subtle.importKey(
      'raw',
      hashBuffer,
      { name: 'AES-GCM' },
      false,
      ['encrypt', 'decrypt']
    );
  }
}

// Convert ArrayBuffer to base64 string
function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Convert base64 string to ArrayBuffer
function base64ToArrayBuffer(base64) {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

// Make TypeScript happy with the web worker context
export {};

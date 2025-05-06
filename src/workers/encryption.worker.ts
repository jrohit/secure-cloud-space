
import CryptoJS from 'crypto-js';

// Size for processing chunks (in bytes)
const CHUNK_PROCESSING_SIZE = 1024 * 1024; // 1MB chunks for processing

// Handle messages from the main thread
self.addEventListener('message', async (event) => {
  const { action, data } = event.data;
  
  switch (action) {
    case 'encrypt':
      try {
        const { fileChunk, encryptionKey, chunkIndex, totalChunks } = data;
        
        // Read the chunk as ArrayBuffer
        const arrayBuffer = await fileChunk.arrayBuffer();
        
        // Process large chunks in smaller pieces to prevent memory issues
        const totalSize = arrayBuffer.byteLength;
        const result = [];
        
        // Process the chunk in smaller pieces
        for (let offset = 0; offset < totalSize; offset += CHUNK_PROCESSING_SIZE) {
          const size = Math.min(CHUNK_PROCESSING_SIZE, totalSize - offset);
          const slice = new Uint8Array(arrayBuffer, offset, size);
          
          // Convert the slice to a word array
          const wordArray = CryptoJS.lib.WordArray.create(slice);
          
          // Encrypt the word array
          const encrypted = CryptoJS.AES.encrypt(wordArray, encryptionKey).toString();
          result.push(encrypted);
          
          // Report progress for large files
          if (totalSize > CHUNK_PROCESSING_SIZE * 10) {
            const processedPercent = Math.round((offset + size) / totalSize * 100);
            self.postMessage({
              progress: processedPercent,
              chunkIndex,
              totalChunks,
              type: 'progress'
            });
          }
        }
        
        // Join all encrypted pieces
        const encrypted = result.join('|||PIECE|||');
        
        // Send the encrypted data back
        self.postMessage({
          encrypted,
          chunkIndex,
          totalChunks,
          error: null,
          type: 'result'
        });
      } catch (error) {
        self.postMessage({ 
          error: `Encryption error: ${error}`, 
          chunkIndex: data.chunkIndex,
          type: 'error' 
        });
      }
      break;
      
    case 'decrypt':
      try {
        const { encryptedText, encryptionKey, originalType, chunkIndex, totalChunks } = data;
        
        let decryptedData;
        
        // Check if the encrypted text contains pieces
        if (encryptedText.includes('|||PIECE|||')) {
          // Split the pieces and decrypt each one
          const pieces = encryptedText.split('|||PIECE|||');
          const decryptedPieces = [];
          
          for (let i = 0; i < pieces.length; i++) {
            const decrypted = CryptoJS.AES.decrypt(pieces[i], encryptionKey);
            const wordArrayToUint8Array = (wordArray) => {
              const words = wordArray.words;
              const sigBytes = wordArray.sigBytes;
              const u8 = new Uint8Array(sigBytes);
              let byte = 0;
              let j = 0;
              for (let i = 0; i < sigBytes; i++) {
                const idx = Math.floor(i / 4);
                const bitShift = 24 - 8 * (i % 4);
                u8[i] = (words[idx] >>> bitShift) & 0xff;
              }
              return u8;
            };
            
            const uint8Array = wordArrayToUint8Array(decrypted);
            decryptedPieces.push(uint8Array);
            
            // Report progress for large files
            if (pieces.length > 10) {
              const processedPercent = Math.round((i + 1) / pieces.length * 100);
              self.postMessage({
                progress: processedPercent,
                chunkIndex,
                totalChunks,
                type: 'progress'
              });
            }
          }
          
          // Combine all pieces
          const totalLength = decryptedPieces.reduce((acc, val) => acc + val.length, 0);
          const combined = new Uint8Array(totalLength);
          
          let offset = 0;
          for (const piece of decryptedPieces) {
            combined.set(piece, offset);
            offset += piece.length;
          }
          
          decryptedData = combined.buffer;
        } else {
          // For backward compatibility or simple decryption
          const decrypted = CryptoJS.AES.decrypt(encryptedText, encryptionKey);
          
          // Convert to ArrayBuffer
          const wordArrayToUint8Array = (wordArray) => {
            const words = wordArray.words;
            const sigBytes = wordArray.sigBytes;
            const u8 = new Uint8Array(sigBytes);
            for (let i = 0; i < sigBytes; i++) {
              const idx = Math.floor(i / 4);
              const bitShift = 24 - 8 * (i % 4);
              u8[i] = (words[idx] >>> bitShift) & 0xff;
            }
            return u8;
          };
          
          decryptedData = wordArrayToUint8Array(decrypted).buffer;
        }
        
        self.postMessage({
          decryptedData,
          originalType,
          chunkIndex,
          totalChunks,
          error: null,
          type: 'result'
        }, [decryptedData]);
      } catch (error) {
        self.postMessage({ 
          error: `Decryption error: ${error}`, 
          chunkIndex: data.chunkIndex,
          type: 'error'
        });
      }
      break;
      
    default:
      self.postMessage({ error: `Unknown action: ${action}`, type: 'error' });
  }
});

// Make TypeScript happy with the web worker context
export {};

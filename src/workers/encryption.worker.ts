
import CryptoJS from 'crypto-js';

// Size for processing chunks (in bytes)
const CHUNK_PROCESSING_SIZE = 4 * 1024 * 1024; // 4MB chunks for processing
const MAX_MEMORY_USAGE = 1024 * 1024 * 1024; // 1GB maximum memory usage

// Handle messages from the main thread
self.addEventListener('message', async (event) => {
  const { action, data } = event.data;
  
  switch (action) {
    case 'encrypt':
      try {
        const { fileChunk, encryptionKey, chunkIndex, totalChunks, fileName } = data;
        
        // Read the chunk as ArrayBuffer
        const arrayBuffer = await fileChunk.arrayBuffer();
        
        // Process large chunks in smaller pieces to prevent memory issues
        const totalSize = arrayBuffer.byteLength;
        const result = [];
        
        // Generate a random IV for this chunk
        const iv = CryptoJS.lib.WordArray.random(16);
        
        // Process the chunk in smaller pieces
        for (let offset = 0; offset < totalSize; offset += CHUNK_PROCESSING_SIZE) {
          const size = Math.min(CHUNK_PROCESSING_SIZE, totalSize - offset);
          const slice = new Uint8Array(arrayBuffer, offset, size);
          
          // Convert the slice to a word array
          const wordArray = CryptoJS.lib.WordArray.create(slice);
          
          // Encrypt the word array
          const encrypted = CryptoJS.AES.encrypt(wordArray, encryptionKey, {
            iv: iv,
            mode: CryptoJS.mode.CBC,
            padding: CryptoJS.pad.Pkcs7
          }).toString();
          
          result.push(encrypted);
          
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
        
        // Join all encrypted pieces
        const encrypted = result.join('|||PIECE|||');
        
        // Send the encrypted data with IV back
        self.postMessage({
          encrypted,
          iv: iv.toString(CryptoJS.enc.Hex),
          chunkIndex,
          totalChunks,
          fileName,
          error: null,
          type: 'result'
        });
      } catch (error) {
        self.postMessage({ 
          error: `Encryption error: ${error}`, 
          chunkIndex: data.chunkIndex,
          fileName: data.fileName,
          type: 'error' 
        });
      }
      break;
      
    case 'decrypt':
      try {
        const { encryptedText, iv, encryptionKey, originalType, chunkIndex, totalChunks, fileName } = data;
        
        let decryptedData;
        
        // Check if the encrypted text contains pieces
        if (encryptedText.includes('|||PIECE|||')) {
          // Split the pieces and decrypt each one
          const pieces = encryptedText.split('|||PIECE|||');
          const decryptedPieces = [];
          
          // Parse IV from hex string
          const ivWordArray = CryptoJS.enc.Hex.parse(iv);
          
          for (let i = 0; i < pieces.length; i++) {
            try {
              const decrypted = CryptoJS.AES.decrypt(pieces[i], encryptionKey, {
                iv: ivWordArray,
                mode: CryptoJS.mode.CBC,
                padding: CryptoJS.pad.Pkcs7
              });
              
              // Convert WordArray to Uint8Array
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
              
              const uint8Array = wordArrayToUint8Array(decrypted);
              decryptedPieces.push(uint8Array);
              
              // Report progress for large files
              if (pieces.length > 10) {
                const processedPercent = Math.round((i + 1) / pieces.length * 100);
                self.postMessage({
                  progress: processedPercent,
                  chunkIndex,
                  totalChunks,
                  fileName,
                  type: 'progress'
                });
              }
            } catch (error) {
              console.error(`Error decrypting piece ${i}:`, error);
              throw new Error(`Failed to decrypt piece ${i}: ${error.message}`);
            }
            
            // Allow garbage collection to prevent memory issues
            await new Promise(resolve => setTimeout(resolve, 0));
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
          // Parse IV from hex string
          const ivWordArray = CryptoJS.enc.Hex.parse(iv);
          
          const decrypted = CryptoJS.AES.decrypt(encryptedText, encryptionKey, {
            iv: ivWordArray,
            mode: CryptoJS.mode.CBC,
            padding: CryptoJS.pad.Pkcs7
          });
          
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
        
        // Using structured clone to transfer the ArrayBuffer
        self.postMessage({
          decryptedData,
          originalType,
          chunkIndex,
          totalChunks,
          fileName,
          error: null,
          type: 'result'
        }, [decryptedData]);
      } catch (error) {
        self.postMessage({ 
          error: `Decryption error: ${error}`, 
          chunkIndex: data.chunkIndex,
          fileName: data.fileName,
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

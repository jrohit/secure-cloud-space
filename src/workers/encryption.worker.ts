import CryptoJS from "crypto-js";

// Handle messages from the main thread
self.addEventListener("message", async (event) => {
  const { action, data } = event.data;

  switch (action) {
    case "encrypt":
      try {
        const { fileChunk, encryptionKey, chunkIndex, totalChunks } = data;

        // Convert the chunk to a word array
        const reader = new FileReader();
        reader.onload = (e) => {
          if (!e.target || !e.target.result) {
            self.postMessage({
              error: "Failed to read file chunk",
              chunkIndex,
            });
            return;
          }
          const arrayBuffer = e.target.result as ArrayBuffer;
          const wordArray = CryptoJS.lib.WordArray.create(arrayBuffer);

          // // Encrypt the word array
          // const encrypted = CryptoJS.AES.encrypt(
          //   wordArray,
          //   encryptionKey
          // ).toString();

          // // Send the encrypted data back
          // self.postMessage({
          //   encrypted,
          //   chunkIndex,
          //   totalChunks,
          //   error: null,
          // });

          const encrypted = CryptoJS.AES.encrypt(wordArray, encryptionKey);

          // Convert the ciphertext WordArray to Uint8Array
          const encryptedWords = encrypted.ciphertext;
          const encryptedBytes = new Uint8Array(encryptedWords.sigBytes);
          for (let i = 0; i < encryptedWords.sigBytes; i++) {
            encryptedBytes[i] =
              (encryptedWords.words[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff;
          }

          self.postMessage(
            {
              encrypted: encryptedBytes.buffer,
              chunkIndex,
              totalChunks,
              error: null,
            },
            [encryptedBytes.buffer] // Transfer the buffer
          );
        };

        reader.onerror = () => {
          self.postMessage({
            error: "Error reading file chunk",
            chunkIndex,
          });
        };

        reader.readAsArrayBuffer(fileChunk);
      } catch (error) {
        self.postMessage({
          error: `Encryption error: ${error}`,
          chunkIndex: data.chunkIndex,
        });
      }
      break;

    case "decrypt":
      try {
        const {
          encryptedText,
          encryptionKey,
          originalType,
          chunkIndex,
          totalChunks,
        } = data;

        // Decrypt the text
        const decrypted = CryptoJS.AES.decrypt(encryptedText, encryptionKey);
        const decryptedString = decrypted.toString(CryptoJS.enc.Utf8);

        self.postMessage({
          decrypted: decryptedString,
          originalType,
          chunkIndex,
          totalChunks,
          error: null,
        });
      } catch (error) {
        self.postMessage({
          error: `Decryption error: ${error}`,
          chunkIndex: data.chunkIndex,
        });
      }
      break;

    default:
      self.postMessage({ error: `Unknown action: ${action}` });
  }
});

// Make TypeScript happy with the web worker context
export {};

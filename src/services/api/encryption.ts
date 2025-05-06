
import CryptoJS from 'crypto-js';

export const encryptionService = {
  /**
   * Generates an encryption key based on user credentials
   * This is a deterministic way to create a key that only the user can recreate
   */
  generateUserEncryptionKey: (userId: string, token: string): string => {
    // Create a deterministic key based on user ID and auth token
    // In a real-world scenario, this might use a more sophisticated key derivation function
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
   * Encrypt file content - this is a simplified version for demonstration
   * For larger files, chunking and streaming would be required
   */
  encryptFile: async (file: Blob, encryptionKey: string): Promise<Blob> => {
    // Convert file to array buffer
    const arrayBuffer = await file.arrayBuffer();
    const wordArray = CryptoJS.lib.WordArray.create(arrayBuffer);
    
    // Encrypt the word array
    const encrypted = CryptoJS.AES.encrypt(wordArray, encryptionKey).toString();
    
    // Convert encrypted string back to Blob
    return new Blob([encrypted], { type: 'application/encrypted' });
  },
  
  /**
   * Decrypt file content - simplified version
   */
  decryptFile: async (encryptedBlob: Blob, encryptionKey: string, originalType: string): Promise<Blob> => {
    // Convert encrypted blob to text
    const encryptedText = await encryptedBlob.text();
    
    // Decrypt the text
    const decrypted = CryptoJS.AES.decrypt(encryptedText, encryptionKey);
    const wordArray = decrypted.toString(CryptoJS.enc.Utf8);
    
    // Convert decrypted string back to Blob with original type
    return new Blob([wordArray], { type: originalType });
  }
};

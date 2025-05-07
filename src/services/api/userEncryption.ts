
import CryptoJS from "crypto-js";
import { User } from "@/types";

/**
 * Service for handling user-specific encryption keys and operations
 */
export const userEncryptionService = {
  /**
   * Derives an encryption key from user password
   * @param password - User's password
   * @param salt - Salt for key derivation (hex encoded)
   * @returns Key derived from password
   */
  deriveKeyFromPassword: (password: string, salt: string): CryptoJS.lib.WordArray => {
    // Convert hex salt to WordArray
    const saltWordArray = CryptoJS.enc.Hex.parse(salt);
    
    // Use PBKDF2 to derive a key (512 bits) with 10000 iterations
    return CryptoJS.PBKDF2(password, saltWordArray, { 
      keySize: 512/32, // 512 bits / 32 bits per word
      iterations: 10000
    });
  },

  /**
   * Encrypts the master key with the user's password
   * @param masterKey - The master key to encrypt (as WordArray or string)
   * @param password - User's password
   * @param salt - Salt for key derivation (hex encoded)
   * @returns Object containing hex-encoded IV, ciphertext, and authentication tag
   */
  encryptMasterKey: (masterKey: string | CryptoJS.lib.WordArray, password: string, salt: string): {
    iv: string;
    ciphertext: string;
    tag: string;
  } => {
    // Derive key from password
    const derivedKey = userEncryptionService.deriveKeyFromPassword(password, salt);
    
    // Generate random IV (128 bits)
    const iv = CryptoJS.lib.WordArray.random(16); 
    
    // Convert master key to WordArray if it's a string
    const masterKeyWordArray = typeof masterKey === 'string' 
      ? CryptoJS.enc.Utf8.parse(masterKey) 
      : masterKey;
    
    // Encrypt master key using AES-GCM
    const encrypted = CryptoJS.AES.encrypt(masterKeyWordArray, derivedKey, {
      iv: iv,
      mode: CryptoJS.mode.GCM,
      padding: CryptoJS.pad.NoPadding
    });
    
    // Return hex-encoded values
    return {
      iv: iv.toString(CryptoJS.enc.Hex),
      ciphertext: encrypted.ciphertext.toString(CryptoJS.enc.Hex),
      tag: encrypted.tag.toString(CryptoJS.enc.Hex)
    };
  },

  /**
   * Decrypts the master key using the user's password
   * @param encryptedData - Object containing hex-encoded IV, ciphertext, and authentication tag
   * @param password - User's password
   * @param salt - Salt for key derivation (hex encoded)
   * @returns Decrypted master key as a string
   */
  decryptMasterKey: (
    encryptedData: { iv: string; ciphertext: string; tag: string },
    password: string,
    salt: string
  ): string => {
    try {
      // Derive key from password
      const derivedKey = userEncryptionService.deriveKeyFromPassword(password, salt);
      
      // Convert hex values to WordArrays
      const iv = CryptoJS.enc.Hex.parse(encryptedData.iv);
      const ciphertext = CryptoJS.enc.Hex.parse(encryptedData.ciphertext);
      const tag = CryptoJS.enc.Hex.parse(encryptedData.tag);
      
      // Create CipherParams object
      const cipherParams = CryptoJS.lib.CipherParams.create({
        ciphertext: ciphertext,
        iv: iv,
        tag: tag,
        algorithm: CryptoJS.algo.AES,
        mode: CryptoJS.mode.GCM,
        padding: CryptoJS.pad.NoPadding,
        blockSize: 4
      });
      
      // Decrypt the master key
      const decrypted = CryptoJS.AES.decrypt(cipherParams, derivedKey, {
        iv: iv,
        mode: CryptoJS.mode.GCM,
        padding: CryptoJS.pad.NoPadding
      });
      
      return decrypted.toString(CryptoJS.enc.Utf8);
    } catch (error) {
      console.error("Failed to decrypt master key:", error);
      throw new Error("Failed to decrypt master key");
    }
  },

  /**
   * Generates a new master key and related encryption parameters
   * @returns Object containing master key, salt, iv, and tag
   */
  generateMasterKeyAndParams: (password: string): {
    masterKey: string;
    encryptedMasterKey: string;
    salt: string;
    iv: string;
    tag: string;
  } => {
    // Generate a random 256-bit master key
    const masterKey = CryptoJS.lib.WordArray.random(32).toString(CryptoJS.enc.Hex);
    
    // Generate a random salt (128 bits)
    const salt = CryptoJS.lib.WordArray.random(16).toString(CryptoJS.enc.Hex);
    
    // Encrypt the master key with the password
    const encryptedData = userEncryptionService.encryptMasterKey(masterKey, password, salt);
    
    return {
      masterKey,
      encryptedMasterKey: encryptedData.ciphertext,
      salt,
      iv: encryptedData.iv,
      tag: encryptedData.tag
    };
  },

  /**
   * Encrypts file or folder name using the master key
   */
  encryptName: (name: string, masterKey: string): string => {
    return CryptoJS.AES.encrypt(name, masterKey).toString();
  },

  /**
   * Decrypts file or folder name using the master key
   */
  decryptName: (encryptedName: string | null | undefined, masterKey: string): string => {
    if (!encryptedName) return "";
    try {
      const bytes = CryptoJS.AES.decrypt(encryptedName, masterKey);
      return bytes.toString(CryptoJS.enc.Utf8);
    } catch (error) {
      console.error("Failed to decrypt name:", error);
      return encryptedName; // Return the encrypted name if decryption fails
    }
  },

  /**
   * Retrieves or creates the master key for a user
   */
  getMasterKey: async (user: User | null, token: string | null): Promise<string | null> => {
    if (!user || !token) return null;
    
    try {
      // Try to get from localStorage first
      const cachedMasterKey = localStorage.getItem(`masterKey_${user.id}`);
      if (cachedMasterKey) {
        return cachedMasterKey;
      }
      
      // If not in localStorage, we'd need the password to decrypt it
      // This would typically be part of a login flow where user provides password
      // For now, we'll return null in this case
      return null;
    } catch (error) {
      console.error("Error retrieving master key:", error);
      return null;
    }
  },
  
  /**
   * Save the master key to localStorage for current session
   */
  saveMasterKey: (userId: string, masterKey: string): void => {
    localStorage.setItem(`masterKey_${userId}`, masterKey);
  },
  
  /**
   * Clear the master key from localStorage
   */
  clearMasterKey: (userId: string): void => {
    localStorage.removeItem(`masterKey_${userId}`);
  }
};

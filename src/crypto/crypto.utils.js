import crypto from 'react-native-quick-crypto';
import { Buffer } from 'buffer'; // react-native-quick-crypto provides Buffer

// --- Configuration ---
const SALT_SIZE = 16; // bytes
const IV_SIZE = 12; // bytes for AES-GCM
const KEY_LENGTH = 32; // bytes for AES-256
const PBKDF2_ITERATIONS = 100000; // Standard recommendation
const DIGEST = 'sha256'; // For PBKDF2
const AES_ALGORITHM = 'aes-256-gcm'; // AES GCM for authenticated encryption

// --- Helper Functions ---

/**
 * Converts an ArrayBuffer to a Base64 string.
 * @param {ArrayBuffer} buffer The ArrayBuffer to convert.
 * @returns {string} The Base64 encoded string.
 */
export function arrayBufferToBase64(buffer) {
  return Buffer.from(buffer).toString('base64');
}

/**
 * Converts a Base64 string to an ArrayBuffer.
 * @param {string} base64 The Base64 string to convert.
 * @returns {ArrayBuffer} The decoded ArrayBuffer.
 */
export function base64ToArrayBuffer(base64) {
  const buf = Buffer.from(base64, 'base64');
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
}

// --- Core Cryptographic Functions ---

/**
 * Generates a cryptographically strong random master key.
 * For AES-256, this should be 32 bytes.
 * @returns {Promise<string>} A promise that resolves to a Base64 encoded master key.
 */
export async function generateMasterKey() {
  // react-native-quick-crypto's randomBytes returns a Buffer
  const rawMasterKeyBuffer = crypto.randomBytes(KEY_LENGTH);
  return rawMasterKeyBuffer.toString('base64'); // Store/handle as base64 string
}

/**
 * Generates a random salt.
 * @param {number} size The size of the salt in bytes. Default is SALT_SIZE.
 * @returns {ArrayBuffer} A promise that resolves to an ArrayBuffer containing the salt.
 */
export function generateSalt(size = SALT_SIZE) {
  return crypto.randomBytes(size).buffer;
}

/**
 * Derives a key from a password and salt using PBKDF2.
 * @param {string} password The password.
 *   Expected to be ArrayBuffer, but string is common input. Convert if needed.
 * @param {ArrayBuffer} salt The salt.
 * @returns {Promise<ArrayBuffer>} A promise that resolves to the derived key as an ArrayBuffer.
 */
export async function deriveKeyFromPassword(password, salt) {
  // Ensure password and salt are Buffers for pbkdf2Sync
  const passwordBuffer = Buffer.from(password, 'utf-8');
  const saltBuffer = Buffer.from(salt);

  // quick-crypto's pbkdf2 is synchronous but can be wrapped in Promise if needed for consistency
  // For simplicity here, keeping it direct. If it were a true async native call, await would be used.
  return new Promise((resolve, reject) => {
    try {
      const derivedKey = crypto.pbkdf2Sync(
        passwordBuffer,
        saltBuffer,
        PBKDF2_ITERATIONS,
        KEY_LENGTH,
        DIGEST,
      );
      resolve(derivedKey.buffer.slice(derivedKey.byteOffset, derivedKey.byteOffset + derivedKey.byteLength));
    } catch (error) {
      console.error('Error deriving key from password:', error);
      reject(error);
    }
  });
}

/**
 * Encrypts the master key using AES-GCM with a Key Encryption Key (KEK).
 * @param {ArrayBuffer} masterKeyArrayBuffer The raw master key to encrypt (as ArrayBuffer).
 * @param {ArrayBuffer} kekArrayBuffer The Key Encryption Key (derived from password, as ArrayBuffer).
 * @returns {Promise<{ciphertext: ArrayBuffer, iv: ArrayBuffer, authTag: ArrayBuffer}>}
 *          A promise that resolves to an object containing the ciphertext, IV, and authTag.
 */
export async function encryptMasterKey(masterKeyArrayBuffer, kekArrayBuffer) {
  return new Promise((resolve, reject) => {
    try {
      const iv = crypto.randomBytes(IV_SIZE);
      const kekBuffer = Buffer.from(kekArrayBuffer); // Ensure KEK is a Buffer

      const cipher = crypto.createCipheriv(AES_ALGORITHM, kekBuffer, iv);

      let ciphertext = cipher.update(Buffer.from(masterKeyArrayBuffer));
      ciphertext = Buffer.concat([ciphertext, cipher.final()]);
      const authTag = cipher.getAuthTag(); // Get the GCM authentication tag

      resolve({
        ciphertext: ciphertext.buffer.slice(ciphertext.byteOffset, ciphertext.byteOffset + ciphertext.byteLength),
        iv: iv.buffer.slice(iv.byteOffset, iv.byteOffset + iv.byteLength),
        authTag: authTag.buffer.slice(authTag.byteOffset, authTag.byteOffset + authTag.byteLength), // Important for GCM
      });
    } catch (error) {
      console.error('Error encrypting master key:', error);
      reject(error);
    }
  });
}

/**
 * Decrypts an encrypted master key string using a Key Encryption Key (KEK).
 * The encryptedMasterKeyString is expected to be in the format: saltBase64:ivBase64:ciphertextBase64:authTagBase64
 * (Adjusting based on typical GCM handling: salt is usually handled outside, as it's needed to re-derive KEK first)
 *
 * Let's redefine the input for decryption:
 * @param {string} saltBase64 Base64 encoded salt (used to derive the KEK).
 * @param {string} ivBase64 Base64 encoded IV.
 * @param {string} ciphertextBase64 Base64 encoded ciphertext.
 * @param {string} authTagBase64 Base64 encoded GCM authentication tag.
 * @param {ArrayBuffer} kekArrayBuffer The Key Encryption Key (derived from password, as ArrayBuffer).
 * @returns {Promise<ArrayBuffer>} A promise that resolves to the decrypted raw master key (as ArrayBuffer).
 */
export async function decryptMasterKeyWithComponents(ivBase64, ciphertextBase64, authTagBase64, kekArrayBuffer) {
  return new Promise((resolve, reject) => {
    try {
      const iv = Buffer.from(base64ToArrayBuffer(ivBase64));
      const ciphertext = Buffer.from(base64ToArrayBuffer(ciphertextBase64));
      const authTag = Buffer.from(base64ToArrayBuffer(authTagBase64));
      const kekBuffer = Buffer.from(kekArrayBuffer); // Ensure KEK is a Buffer

      const decipher = crypto.createDecipheriv(AES_ALGORITHM, kekBuffer, iv);
      decipher.setAuthTag(authTag); // Set the GCM authentication tag

      let decrypted = decipher.update(ciphertext);
      decrypted = Buffer.concat([decrypted, decipher.final()]); // Throws on auth failure

      resolve(decrypted.buffer.slice(decrypted.byteOffset, decrypted.byteOffset + decrypted.byteLength));
    } catch (error) {
      console.error('Error decrypting master key (authenticationอาจจะล้มเหลว):', error); // "อาจจะล้มเหลว" means "may fail" in Thai - error in my thought process. Should be "authentication may have failed"
      reject(new Error('Decryption failed. Key or ciphertext may be incorrect, or data tampered.'));
    }
  });
}


/**
 * A wrapper function to handle the combined encrypted string as per user's initial description
 * for the string stored in DB: saltBase64:ivBase64:ciphertextBase64
 * NOTE: For GCM, the authTag is crucial. The original description didn't explicitly mention where authTag is stored.
 * Assuming the server-side `encryptedMasterKeyData.ciphertext` from the user's example *already includes* the authTag,
 * or it's concatenated, or the `encryptMasterKey` on the server side handles this differently (e.g. not using GCM or appending tag).
 *
 * For this client-side implementation, `encryptMasterKey` produces a separate `authTag`.
 * We need to decide how this `authTag` is combined with `iv` and `ciphertext` to match the string
 * `saltBase64:ivBase64:ciphertextBase64` that the user mentioned is stored in the DB.
 *
 * Option 1: The `ciphertextBase64` in the DB string implicitly contains the authTag. (Less common for separate getAuthTag())
 * Option 2: The string format is actually `saltBase64:ivBase64:ciphertextAndAuthTagBase64`.
 * Option 3: The string format is `saltBase64:ivBase64:ciphertextBase64:authTagBase64`. This is more explicit.
 *
 * Let's assume Option 3 for robust GCM handling and define the string format as:
 * `saltBase64:ivBase64:authTagBase64:ciphertextBase64`
 * The `encryptedMasterKeyString` sent to `auth/register` should be this.
 * The `decryptMasterKey` function will parse this.
 */

/**
 * Encrypts the master key and prepares it as a single string for storage/transmission.
 * Format: saltBase64:ivBase64:authTagBase64:ciphertextBase64
 * @param {string} rawMasterKeyBase64 The raw master key (base64 encoded).
 * @param {string} password The user's password.
 * @returns {Promise<string>} The full encrypted master key string.
 */
export async function encryptMasterKeyForStorage(rawMasterKeyBase64, password) {
    const salt = generateSalt(); // ArrayBuffer
    const kek = await deriveKeyFromPassword(password, salt); // ArrayBuffer

    const masterKeyArrayBuffer = base64ToArrayBuffer(rawMasterKeyBase64);
    const encryptedData = await encryptMasterKey(masterKeyArrayBuffer, kek); // { ciphertext, iv, authTag } all ArrayBuffer

    const saltBase64 = arrayBufferToBase64(salt);
    const ivBase64 = arrayBufferToBase64(encryptedData.iv);
    const authTagBase64 = arrayBufferToBase64(encryptedData.authTag);
    const ciphertextBase64 = arrayBufferToBase64(encryptedData.ciphertext);

    return `${saltBase64}:${ivBase64}:${authTagBase64}:${ciphertextBase64}`;
}


/**
 * Decrypts the master key from the combined string format.
 * Format: saltBase64:ivBase64:authTagBase64:ciphertextBase64
 * @param {string} encryptedMasterKeyString The full encrypted string.
 * @param {string} password The user's password.
 * @returns {Promise<ArrayBuffer>} The decrypted raw master key as ArrayBuffer.
 */
export async function decryptMasterKeyFromStorage(encryptedMasterKeyString, password) {
    const parts = encryptedMasterKeyString.split(':');
    if (parts.length !== 4) {
        throw new Error('Invalid encrypted master key string format.');
    }
    const [saltBase64, ivBase64, authTagBase64, ciphertextBase64] = parts;

    const salt = base64ToArrayBuffer(saltBase64);
    const kek = await deriveKeyFromPassword(password, salt); // ArrayBuffer

    // Now call the component-based decryption function
    return decryptMasterKeyWithComponents(ivBase64, ciphertextBase64, authTagBase64, kek);
}
console.log('Crypto utils loaded. AES Algorithm:', AES_ALGORITHM);

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)));
}

export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

export function generateSalt(length: number = 16): ArrayBuffer {
  const salt = new Uint8Array(length);
  window.crypto.getRandomValues(salt);
  return salt.buffer;
}

export async function generateMasterKey(): Promise<string> {
  const key = await window.crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true, // extractable
    ['encrypt', 'decrypt']
  );
  const exportedKey = await window.crypto.subtle.exportKey('raw', key);
  return arrayBufferToBase64(exportedKey);
}

export async function deriveKeyFromPassword(
  password: string,
  salt: ArrayBuffer,
  iterations: number = 100000
): Promise<CryptoKey> {
  const passwordKey = await window.crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: iterations,
      hash: 'SHA-256',
    },
    passwordKey,
    { name: 'AES-GCM', length: 256 },
    false, // extractable
    ['encrypt', 'decrypt']
  );
}

export async function encryptMasterKey(
  masterKeyRaw: ArrayBuffer,
  derivedKey: CryptoKey
): Promise<{ iv: ArrayBuffer, ciphertext: ArrayBuffer }> {
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv },
    derivedKey,
    masterKeyRaw
  );
  return { iv, ciphertext };
}

export async function decryptFile(
  encryptedFileBuffer: ArrayBuffer,
  masterKey: CryptoKey
): Promise<ArrayBuffer> {
  if (encryptedFileBuffer.byteLength < 12) {
    throw new Error("Invalid encrypted data: too short to contain IV.");
  }

  const iv = encryptedFileBuffer.slice(0, 12);
  const ciphertext = encryptedFileBuffer.slice(12);

  try {
    const decryptedContent = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv },
      masterKey,
      ciphertext
    );
    return decryptedContent;
  } catch (error) {
    console.error("File decryption failed:", error);
    throw new Error("File decryption failed. The key may be incorrect or data corrupted.");
  }
}

export async function decryptMasterKey(
  encryptedMasterKeyString: string,
  passwordForKek: string
): Promise<ArrayBuffer> {
  const parts = encryptedMasterKeyString.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encryptedMasterKeyString format. Expected salt:iv:ciphertext');
  }

  const [saltBase64, ivBase64, encryptedMasterKeyCiphertextBase64] = parts;

  const saltBytes = base64ToArrayBuffer(saltBase64);
  const ivBytes = base64ToArrayBuffer(ivBase64);
  const masterKeyCiphertextBytes = base64ToArrayBuffer(encryptedMasterKeyCiphertextBase64);

  const kek = await deriveKeyFromPassword(passwordForKek, saltBytes);

  const decryptedMasterKey = await window.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: ivBytes },
    kek,
    masterKeyCiphertextBytes
  );

  return decryptedMasterKey;
}

export async function encryptFile(
  fileArrayBuffer: ArrayBuffer,
  masterKey: CryptoKey
): Promise<{ iv: ArrayBuffer, ciphertext: ArrayBuffer }> {
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv },
    masterKey,
    fileArrayBuffer
  );
  return { iv, ciphertext };
}

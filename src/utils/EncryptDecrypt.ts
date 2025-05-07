const encryptionKey = import.meta.env.VITE_ENCRYPT_DECRYPT_KEY; // get the encryption key from the environment variable

export const fetchAndDecryptFile = async (
  filename: string,
  encryptionKey: string
) => {
  const response = await fetch(`http://localhost:5000/api/file/${filename}`);
  if (!response.ok) {
    throw new Error("Failed to fetch file");
  }

  const encryptedBuffer = await response.arrayBuffer();
  const encryptedBytes = new Uint8Array(encryptedBuffer);

  const iv = encryptedBytes.slice(0, 16); // First 16 bytes = IV
  const encryptedContent = encryptedBytes.slice(16); // Rest = ciphertext

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(encryptionKey.slice(0, 32)),
    { name: "AES-CBC" },
    false,
    ["decrypt"]
  );

  const decryptedBuffer = await crypto.subtle.decrypt(
    { name: "AES-CBC", iv },
    key,
    encryptedContent
  );

  // Create and download blob
  const blob = new Blob([decryptedBuffer]);
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = filename.replace(".encrypted", ""); // remove .encrypted extension
  link.click();
  URL.revokeObjectURL(url);
};

export const encryptAndUpload = async (
  files: FileList,
  onProgress: (filename: string, progress: number) => void,
  onComplete: (filename: string) => void,
  onError: (filename: string, error: Error) => void
) => {
  debugger;
  if (!files || files.length === 0) {
    console.warn("No files to upload.");
    return;
  }

  const encryptFileNew = async (file: File, formData: FormData) => {
    return new Promise<void>((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = async (event) => {
        try {
          if (!event.target?.result) {
            reject(new Error(`Failed to read file: ${file.name}`));
            return;
          }

          const arrayBuffer = event.target.result as ArrayBuffer;

          const iv = crypto.getRandomValues(new Uint8Array(16)); // AES-CBC IV

          // Import a 256-bit key from the provided string
          const cryptoKey = await crypto.subtle.importKey(
            "raw",
            new TextEncoder().encode(encryptionKey.slice(0, 32)), // truncate to 32 bytes
            { name: "AES-CBC" },
            false,
            ["encrypt"]
          );

          const encryptedData = await crypto.subtle.encrypt(
            { name: "AES-CBC", iv },
            cryptoKey,
            arrayBuffer
          );

          // Combine IV + encrypted content
          const finalData = new Uint8Array(
            iv.length + encryptedData.byteLength
          );
          finalData.set(iv, 0);
          finalData.set(new Uint8Array(encryptedData), iv.length);

          const encryptedBlob = new Blob([finalData], {
            type: "application/octet-stream",
          });

          console.log(encryptedBlob instanceof Blob);

          formData.append("files", encryptedBlob, file.name + ".encrypted");

          resolve();
        } catch (error: any) {
          reject(
            new Error(`Encryption failed for ${file.name}: ${error.message}`)
          );
        }
      };

      reader.onerror = () => {
        reject(new Error(`Failed to read file: ${file.name}`));
      };

      reader.readAsArrayBuffer(file);
    });
  };

  try {
    // Encrypt each file and add to FormData
    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      await encryptFileNew(files[i], formData);
      // Simulate progress (since encryption happens before upload)
      onProgress(files[i].name, ((i + 1) / files.length) * 50); // 50% for encryption
    }

    return formData;

    // fetchAndDecryptFile(files[0].name + ".encrypted", encryptionKey)
    //   .then((res) => {
    //     console.log("Decrypted file:", res);
    //   })
    //   .catch(console.error);
  } catch (error: any) {
    if (files) {
      for (let i = 0; i < files.length; i++) {
        onError(files[i].name, error); // Pass the error object
      }
    }
    console.error("Error during upload:", error);
  }
};

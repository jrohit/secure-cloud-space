
import { CachedFilesData, File, StorageInfo } from "@/types";
import { API_URL, handleResponse } from "./utils";
import { encryptionService } from "./encryption";

// Create a custom TransformStream for encryption
class EncryptionTransformStream extends TransformStream<Uint8Array, Uint8Array> {
  constructor(encryptionKey: string) {
    let buffer = new Uint8Array();
    let processedChunks = 0;
    
    super({
      transform: async (chunk, controller) => {
        try {
          // For simplicity, we'll process each chunk individually
          // In a real implementation, you might want to combine chunks to a certain size
          const blob = new Blob([chunk]);
          const encrypted = await encryptionService.encryptFile(blob, encryptionKey);
          const encryptedArray = new Uint8Array(await encrypted.arrayBuffer());
          controller.enqueue(encryptedArray);
          processedChunks++;
        } catch (error) {
          console.error('Error in transform stream:', error);
          controller.error(error);
        }
      }
    });
  }
}

export const filesApi = {
  getFiles: async (
    token: string,
    folderId: string | null = null,
    resetCache: boolean | false = false,
    type: string = 'all',
    search: string | null = null
  ): Promise<CachedFilesData> => {
    let url = new URL(`${API_URL}/files`);

    if (folderId) {
      url.searchParams.set("folderId", folderId.toString());
    }

    if (resetCache) {
      url.searchParams.set("resetCache", "true");
    }

    if (type !== 'all') {
      url.searchParams.set("type", type);
    }

    if (search) {
      url.searchParams.set("search", search);
    }

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return handleResponse<CachedFilesData>(response);
  },

  starFile: async (token: string, fileId: string): Promise<{ isStarred: boolean }> => {
    const response = await fetch(`${API_URL}/files/${fileId}/star`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return handleResponse<{ isStarred: boolean }>(response);
  },

  trashFile: async (token: string, fileId: string): Promise<void> => {
    const response = await fetch(`${API_URL}/files/${fileId}/trash`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return handleResponse<void>(response);
  },

  restoreFile: async (token: string, fileId: string): Promise<void> => {
    const response = await fetch(`${API_URL}/files/${fileId}/restore`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return handleResponse<void>(response);
  },

  getStorageInfo: async (token: string): Promise<StorageInfo> => {
    const response = await fetch(`${API_URL}/files/storage-info`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return handleResponse<StorageInfo>(response);
  },

  multipleFileUpload: async ({
    token,
    formData,
    folderId,
    setUploadProgress,
    setIsUploading,
    userId,
  }: {
    token: string;
    formData: FormData;
    folderId: string | null;
    setUploadProgress: (arg0: number) => void;
    setIsUploading: (arg0: boolean) => any;
    userId: string;
  }) => {
    // Generate encryption key
    const encryptionKey = encryptionService.generateUserEncryptionKey(userId, token);
    
    // Create a new FormData for the encrypted files
    const encryptedFormData = new FormData();
    
    // Extract files from formData
    const files = formData.getAll('files');
    
    try {
      setIsUploading(true);
      let totalEncrypted = 0;
      
      // Process each file
      for (let i = 0; i < files.length; i++) {
        const file = files[i] as Blob;
        
        // Store original file type and name in metadata
        const fileMetadata = JSON.stringify({
          originalType: file.type,
          name: file.name || `file-${i}`,
          size: file.size
        });
        
        // Encrypt metadata
        const encryptedMetadata = encryptionService.encryptData(fileMetadata, encryptionKey);
        
        // Encrypt the file using the web worker
        const encryptedFile = await encryptionService.encryptFile(file, encryptionKey);
        
        // Update progress
        totalEncrypted++;
        setUploadProgress(Math.round((totalEncrypted / files.length) * 50)); // First 50% for encryption
        
        // Add encrypted file to form data
        encryptedFormData.append('files', encryptedFile, file.name || `file-${i}`);
        encryptedFormData.append('encryptedMetadata', encryptedMetadata);
      }
      
      if (folderId) {
        encryptedFormData.append("folderId", folderId);
      }
      
      // Upload the encrypted files
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${API_URL}/files/upload`);
      xhr.setRequestHeader("Authorization", `Bearer ${token}`);
      
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          // Second 50% for upload (first 50% was for encryption)
          const uploadPercent = Math.round((event.loaded / event.total) * 50);
          setUploadProgress(50 + uploadPercent);
        }
      };
      
      xhr.onloadend = () => setIsUploading(false);
      
      xhr.onreadystatechange = () => {
        if (xhr.readyState === 4) {
          if (xhr.status === 200 || xhr.status === 201) {
            console.log("Upload complete:", xhr.responseText);
          } else {
            console.error("Upload failed with status:", xhr.status);
          }
        }
      };
      
      xhr.send(encryptedFormData);
    } catch (error) {
      console.error("Error in file encryption/upload:", error);
      setIsUploading(false);
      throw error;
    }
  },

  uploadFile: async (
    token: string,
    fileData: FormData,
    folderId: string | null = null,
    userId: string
  ): Promise<File> => {
    // Generate encryption key
    const encryptionKey = encryptionService.generateUserEncryptionKey(userId, token);
    
    // Get the file from the FormData
    const fileEntry = fileData.get('file');
    if (!fileEntry || !(fileEntry instanceof Blob)) {
      throw new Error('No valid file found in form data');
    }
    
    // Encrypt the file
    const encryptedFile = await encryptionService.encryptFile(fileEntry, encryptionKey);
    
    // Store original file metadata
    const fileMetadata = JSON.stringify({
      originalType: fileEntry.type,
      name: 'file' in fileEntry ? fileEntry.name : 'file'
    });
    
    // Encrypt metadata
    const encryptedMetadata = encryptionService.encryptData(fileMetadata, encryptionKey);
    
    // Create new FormData with encrypted file
    const encryptedFormData = new FormData();
    encryptedFormData.append('file', encryptedFile, 'encrypted-file');
    encryptedFormData.append('encryptedMetadata', encryptedMetadata);
    
    // Add folder ID if provided
    if (folderId) {
      encryptedFormData.append("folderId", folderId);
    }

    const response = await fetch(`${API_URL}/files/upload`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: encryptedFormData,
    });
    return handleResponse<File>(response);
  },

  deleteFile: async (token: string, fileId: string): Promise<void> => {
    const response = await fetch(`${API_URL}/files/${fileId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return handleResponse<void>(response);
  },

  downloadFile: async (token: string, fileId: string, userId: string): Promise<Blob> => {
    // Generate encryption key
    const encryptionKey = encryptionService.generateUserEncryptionKey(userId, token);
    
    // Get file metadata to know the original type
    const fileResponse = await fetch(`${API_URL}/files/${fileId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    const fileMetadata = await handleResponse(fileResponse);
    
    // Download encrypted file
    const response = await fetch(`${API_URL}/files/${fileId}/download`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    
    // Get encrypted blob
    const encryptedBlob = await response.blob();
    
    // Decrypt the file with original type
    return encryptionService.decryptFile(encryptedBlob, encryptionKey, fileMetadata?.type || 'application/octet-stream');
  },

  getFilePreviewUrl: (token: string, fileId: string): string => {
    return `${API_URL}/files/${fileId}/preview?token=${token}`;
  },
};

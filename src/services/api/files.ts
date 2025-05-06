
import { CachedFilesData, File, StorageInfo } from "@/types";
import { API_URL, handleResponse } from "./utils";
import { encryptionService } from "./encryption";

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

  // Check if user has enough storage before uploading
  checkStorageQuota: async (token: string, totalSize: number): Promise<{hasSpace: boolean, storageInfo: StorageInfo}> => {
    const storageInfo = await filesApi.getStorageInfo(token);
    const hasSpace = (storageInfo.storageUsed + totalSize) <= storageInfo.storageLimit;
    
    return {
      hasSpace,
      storageInfo
    };
  },

  multipleFileUpload: async ({
    token,
    files,
    folderId,
    setUploadProgress,
    setIsUploading,
    userId,
  }: {
    token: string;
    files: File[];
    folderId: string | null;
    setUploadProgress: (arg0: number) => void;
    setIsUploading: (arg0: boolean) => any;
    userId: string;
  }) => {
    try {
      setIsUploading(true);
      setUploadProgress(0);
      
      // Calculate total size for quota check
      const totalSize = files.reduce((sum, file) => sum + file.size, 0);
      
      // Check storage quota before encrypting
      const { hasSpace, storageInfo } = await filesApi.checkStorageQuota(token, totalSize);
      
      if (!hasSpace) {
        const remainingSpace = storageInfo.storageLimit - storageInfo.storageUsed;
        throw new Error(`Storage quota exceeded. You need ${(totalSize / (1024 * 1024)).toFixed(2)} MB but only have ${(remainingSpace / (1024 * 1024)).toFixed(2)} MB available.`);
      }
      
      // Generate encryption key
      const encryptionKey = encryptionService.generateUserEncryptionKey(userId, token);
      
      // Process one file at a time to conserve memory
      const totalFiles = files.length;
      
      for (let i = 0; i < totalFiles; i++) {
        const file = files[i];
        
        // Store original file type and name in metadata
        const fileMetadata = JSON.stringify({
          originalType: file.type,
          name: file.name,
          size: file.size
        });
        
        // Encrypt metadata
        const encryptedMetadata = encryptionService.encryptData(fileMetadata, encryptionKey);
        
        // Calculate progress for current file (each file gets an equal portion of progress up to 50%)
        const fileProgressWeight = 50 / totalFiles;
        const fileStartProgress = (i / totalFiles) * 50;
        
        // Encrypt the file using the web worker with progress reporting
        const encryptedFile = await encryptionService.encryptFile(
          file, 
          encryptionKey,
          (progress) => {
            // Map the file's encryption progress (0-100) to its portion of the overall progress
            const mappedProgress = fileStartProgress + (progress / 100 * fileProgressWeight);
            setUploadProgress(Math.round(mappedProgress));
          }
        );
        
        // Add encrypted file and metadata to form data for this batch
        const batchFormData = new FormData();
        batchFormData.append('files', encryptedFile, file.name);
        batchFormData.append('encryptedMetadata', encryptedMetadata);
        
        if (folderId) {
          batchFormData.append("folderId", folderId);
        }
        
        // Upload this file
        const uploadStartProgress = 50 + (i / totalFiles) * 50;
        const uploadEndProgress = 50 + ((i + 1) / totalFiles) * 50;
        
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open("POST", `${API_URL}/files/upload`);
          xhr.setRequestHeader("Authorization", `Bearer ${token}`);
          
          xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
              // Calculate progress for this file's upload
              const fileUploadProgress = event.loaded / event.total;
              const overallProgress = uploadStartProgress + (fileUploadProgress * (uploadEndProgress - uploadStartProgress));
              setUploadProgress(Math.round(overallProgress));
            }
          };
          
          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              setUploadProgress(uploadEndProgress);
              resolve();
            } else {
              reject(new Error(`Upload failed with status: ${xhr.status}`));
            }
          };
          
          xhr.onerror = () => reject(new Error('Network error during upload'));
          
          xhr.send(batchFormData);
        });
      }
      
      setUploadProgress(100);
      
    } catch (error) {
      console.error("Error in file encryption/upload:", error);
      throw error;
    } finally {
      setIsUploading(false);
    }
  },

  uploadFile: async (
    token: string,
    file: Blob,
    fileName: string,
    fileType: string,
    folderId: string | null = null,
    userId: string
  ): Promise<File> => {
    // Generate encryption key
    const encryptionKey = encryptionService.generateUserEncryptionKey(userId, token);
    
    // Check storage quota before encrypting
    const { hasSpace } = await filesApi.checkStorageQuota(token, file.size);
    if (!hasSpace) {
      throw new Error('Storage quota exceeded');
    }
    
    // Encrypt the file
    const encryptedFile = await encryptionService.encryptFile(file, encryptionKey);
    
    // Store original file metadata
    const fileMetadata = JSON.stringify({
      originalType: fileType,
      name: fileName
    });
    
    // Encrypt metadata
    const encryptedMetadata = encryptionService.encryptData(fileMetadata, encryptionKey);
    
    // Create new FormData with encrypted file
    const encryptedFormData = new FormData();
    encryptedFormData.append('file', encryptedFile, fileName);
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
    
    if (!response.ok) {
      throw new Error(`Failed to download file: ${response.statusText}`);
    }
    
    // Get encrypted blob
    const encryptedBlob = await response.blob();
    
    // Decrypt the file with original type
    return encryptionService.decryptFile(
      encryptedBlob, 
      encryptionKey, 
      fileMetadata?.type || 'application/octet-stream'
    );
  },

  getFilePreviewUrl: (token: string, fileId: string): string => {
    return `${API_URL}/files/${fileId}/preview?token=${token}`;
  },
  
  // Create a cached URL for a file that's been fetched and decrypted
  // This helps avoid re-downloading and decrypting the same file multiple times
  cachedFileUrls: new Map<string, { url: string, timestamp: number }>(),
  
  // Cache expiry time in milliseconds (30 minutes)
  cacheExpiryTime: 30 * 60 * 1000,
  
  // Get a cached file URL or create one if it doesn't exist
  getCachedFileUrl: async (token: string, fileId: string, userId: string): Promise<string> => {
    const cacheKey = `${fileId}-${userId}`;
    const cached = filesApi.cachedFileUrls.get(cacheKey);
    
    // Check if we have a valid cached URL
    if (cached && (Date.now() - cached.timestamp) < filesApi.cacheExpiryTime) {
      return cached.url;
    }
    
    try {
      // Download and decrypt the file
      const blob = await filesApi.downloadFile(token, fileId, userId);
      const url = URL.createObjectURL(blob);
      
      // Cache the URL
      filesApi.cachedFileUrls.set(cacheKey, {
        url,
        timestamp: Date.now()
      });
      
      // Set up cleanup of the URL after cache expires
      setTimeout(() => {
        const cachedItem = filesApi.cachedFileUrls.get(cacheKey);
        if (cachedItem && cachedItem.url === url) {
          URL.revokeObjectURL(url);
          filesApi.cachedFileUrls.delete(cacheKey);
        }
      }, filesApi.cacheExpiryTime);
      
      return url;
    } catch (error) {
      console.error("Error creating cached URL:", error);
      throw error;
    }
  },
  
  // Clean up all cached URLs
  clearCachedFileUrls: () => {
    for (const [key, { url }] of filesApi.cachedFileUrls.entries()) {
      URL.revokeObjectURL(url);
    }
    filesApi.cachedFileUrls.clear();
  }
};

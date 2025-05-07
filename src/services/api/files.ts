
import { CachedFilesData, File, StorageInfo, UploadingFile } from "@/types";
import { encryptionService } from "./encryption";
import { API_URL, handleResponse } from "./utils";
import { userEncryptionService } from "./userEncryption";
import { v4 as uuidv4 } from "uuid";

export const filesApi = {
  /**
   * Get files based on folder, type and search criteria
   */
  getFiles: async (
    token: string,
    folderId: string | null = null,
    resetCache: boolean | false = false,
    type: string = "all",
    search: string | null = null
  ): Promise<CachedFilesData> => {
    let url = new URL(`${API_URL}/files`);

    if (folderId) {
      url.searchParams.set("folderId", folderId.toString());
    }

    if (resetCache) {
      url.searchParams.set("resetCache", "true");
    }

    if (type !== "all") {
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

  /**
   * Star or unstar a file
   */
  starFile: async (
    token: string,
    fileId: string
  ): Promise<{ isStarred: boolean }> => {
    const response = await fetch(`${API_URL}/files/${fileId}/star`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return handleResponse<{ isStarred: boolean }>(response);
  },

  /**
   * Move file to trash
   */
  trashFile: async (token: string, fileId: string): Promise<void> => {
    const response = await fetch(`${API_URL}/files/${fileId}/trash`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return handleResponse<void>(response);
  },

  /**
   * Restore file from trash
   */
  restoreFile: async (token: string, fileId: string): Promise<void> => {
    const response = await fetch(`${API_URL}/files/${fileId}/restore`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return handleResponse<void>(response);
  },

  /**
   * Get storage information for the current user
   */
  getStorageInfo: async (token: string): Promise<StorageInfo> => {
    const response = await fetch(`${API_URL}/files/storage-info`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return handleResponse<StorageInfo>(response);
  },

  /**
   * Check if user has enough storage before uploading
   */
  checkStorageQuota: async (
    token: string,
    totalSize: number
  ): Promise<{ hasSpace: boolean; storageInfo: StorageInfo }> => {
    const storageInfo = await filesApi.getStorageInfo(token);
    const hasSpace =
      storageInfo.storageUsed + totalSize <= storageInfo.storageLimit;

    return {
      hasSpace,
      storageInfo,
    };
  },

  /**
   * Upload multiple files with encryption
   */
  multipleFileUpload: async ({
    token,
    files,
    folderId,
    masterKey,
    onProgress,
    onFileStatusChange,
    userId,
  }: {
    token: string;
    files: File[];
    folderId: string | null;
    masterKey: string;
    onProgress?: (fileId: string, progress: number) => void;
    onFileStatusChange?: (fileId: string, status: UploadingFile['status'], error?: string) => void;
    userId: string;
  }): Promise<File[]> => {
    try {
      // Calculate total size for quota check
      const totalSize = files.reduce((sum, file) => sum + file.size, 0);

      // Check storage quota before encrypting
      const { hasSpace, storageInfo } = await filesApi.checkStorageQuota(
        token,
        totalSize
      );

      if (!hasSpace) {
        const remainingSpace = storageInfo.storageLimit - storageInfo.storageUsed;
        throw new Error(
          `Storage quota exceeded. You need ${(totalSize / (1024 * 1024)).toFixed(2)} MB but only have ${(
            remainingSpace /
            (1024 * 1024)
          ).toFixed(2)} MB available.`
        );
      }

      const uploadedFiles: File[] = [];

      // Process one file at a time to conserve memory
      for (const file of files) {
        const fileId = uuidv4();
        
        try {
          // Update status to encrypting
          onFileStatusChange?.(fileId, 'encrypting');
          
          // Encrypt the file name if we have a master key
          const encryptedName = masterKey 
            ? userEncryptionService.encryptName(file.name, masterKey) 
            : file.name;
          
          // Store original file metadata
          const fileMetadata = JSON.stringify({
            originalName: file.name,
            originalType: file.type,
            size: file.size,
            metadataEncrypted: !!masterKey
          });

          // Encrypt metadata with user-specific key from auth
          const encryptionKey = encryptionService.generateUserEncryptionKey(userId, token);
          const encryptedMetadata = encryptionService.encryptData(fileMetadata, encryptionKey);

          // Encrypt the file using the web worker with progress reporting
          const { encryptedBlob, iv } = await encryptionService.encryptFile(
            file,
            masterKey || encryptionKey, // Use master key if available, otherwise fall back to derived key
            file.name,
            (progress) => {
              onProgress?.(fileId, progress / 2); // First 50% is encryption
            }
          );

          // Update status to uploading
          onFileStatusChange?.(fileId, 'uploading');

          // Create FormData for this file
          const formData = new FormData();
          formData.append("files", encryptedBlob, encryptedName);
          formData.append("encryptedMetadata", encryptedMetadata);
          formData.append("encryptionIV", iv);
          
          if (folderId) {
            formData.append("folderId", folderId);
          }

          // Upload with progress tracking
          const xhr = new XMLHttpRequest();
          
          await new Promise<void>((resolve, reject) => {
            xhr.open("POST", `${API_URL}/files/upload`);
            xhr.setRequestHeader("Authorization", `Bearer ${token}`);
            
            xhr.upload.onprogress = (event) => {
              if (event.lengthComputable) {
                // Second 50% is upload
                const uploadProgress = (event.loaded / event.total) * 50;
                onProgress?.(fileId, 50 + uploadProgress);
              }
            };
            
            xhr.onload = () => {
              if (xhr.status >= 200 && xhr.status < 300) {
                const response = JSON.parse(xhr.responseText);
                uploadedFiles.push(response);
                onProgress?.(fileId, 100);
                onFileStatusChange?.(fileId, 'complete');
                resolve();
              } else {
                const error = `Upload failed with status: ${xhr.status}`;
                onFileStatusChange?.(fileId, 'error', error);
                reject(new Error(error));
              }
            };
            
            xhr.onerror = () => {
              const error = "Network error during upload";
              onFileStatusChange?.(fileId, 'error', error);
              reject(new Error(error));
            };
            
            xhr.send(formData);
          });
        } catch (error) {
          console.error(`Error processing file ${file.name}:`, error);
          onFileStatusChange?.(
            fileId, 
            'error', 
            error instanceof Error ? error.message : String(error)
          );
          // Continue with next file despite error
        }
      }

      return uploadedFiles;
    } catch (error) {
      console.error("Error in file encryption/upload:", error);
      throw error;
    }
  },

  /**
   * Permanently delete a file
   */
  deleteFile: async (token: string, fileId: string): Promise<void> => {
    const response = await fetch(`${API_URL}/files/${fileId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return handleResponse<void>(response);
  },

  /**
   * Download and decrypt a file
   */
  downloadFile: async (
    token: string,
    fileId: string,
    userId: string
  ): Promise<Blob> => {
    // Get file metadata to know the original type
    const fileResponse = await fetch(`${API_URL}/files/${fileId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    const fileMetadata = await handleResponse<File>(fileResponse);

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

    // Generate encryption key from user ID and token
    const encryptionKey = encryptionService.generateUserEncryptionKey(userId, token);

    // Decrypt the file with original type
    return encryptionService.decryptFile(
      encryptedBlob,
      encryptionKey,
      fileMetadata?.type || "application/octet-stream",
      fileMetadata?.encryptionIV
    );
  },

  /**
   * Get URL for file preview
   */
  getFilePreviewUrl: (token: string, fileId: string): string => {
    return `${API_URL}/files/${fileId}/preview?token=${token}`;
  },

  /**
   * Get URL for file thumbnail preview
   */
  getThumbnailUrl: async (token: string, fileId: string, userId: string): Promise<string> => {
    // First try to get from thumbnail cache
    try {
      const cachedUrl = filesApi.cachedFileUrls.get(`thumb_${fileId}_${userId}`);
      if (cachedUrl && Date.now() - cachedUrl.timestamp < filesApi.cacheExpiryTime) {
        return cachedUrl.url;
      }
      
      // If not cached, fetch and decrypt the file to create a thumbnail
      const blob = await filesApi.downloadFile(token, fileId, userId);
      
      // Generate a thumbnail from the blob
      const thumbnail = await encryptionService.generateThumbnail(blob);
      if (thumbnail) {
        const url = URL.createObjectURL(thumbnail);
        
        // Cache the thumbnail URL
        filesApi.cachedFileUrls.set(`thumb_${fileId}_${userId}`, {
          url,
          timestamp: Date.now()
        });
        
        // Set up cleanup
        setTimeout(() => {
          const cachedItem = filesApi.cachedFileUrls.get(`thumb_${fileId}_${userId}`);
          if (cachedItem && cachedItem.url === url) {
            URL.revokeObjectURL(url);
            filesApi.cachedFileUrls.delete(`thumb_${fileId}_${userId}`);
          }
        }, filesApi.cacheExpiryTime);
        
        return url;
      }
      
      // If thumbnail generation failed, return the full file URL
      return filesApi.getCachedFileUrl(token, fileId, userId);
    } catch (error) {
      console.error("Error generating thumbnail:", error);
      // Fall back to server-provided thumbnail or preview endpoint
      return `${API_URL}/files/${fileId}/preview?token=${token}`;
    }
  },

  // Cache expiry time in milliseconds (30 minutes)
  cacheExpiryTime: 30 * 60 * 1000,

  // Create a cached URL for a file that's been fetched and decrypted
  cachedFileUrls: new Map<string, { url: string; timestamp: number }>(),

  /**
   * Get a cached file URL or create one if it doesn't exist
   */
  getCachedFileUrl: async (
    token: string,
    fileId: string,
    userId: string
  ): Promise<string> => {
    const cacheKey = `${fileId}_${userId}`;
    const cached = filesApi.cachedFileUrls.get(cacheKey);

    // Check if we have a valid cached URL
    if (cached && Date.now() - cached.timestamp < filesApi.cacheExpiryTime) {
      return cached.url;
    }

    try {
      // Download and decrypt the file
      const blob = await filesApi.downloadFile(token, fileId, userId);
      const url = URL.createObjectURL(blob);

      // Cache the URL
      filesApi.cachedFileUrls.set(cacheKey, {
        url,
        timestamp: Date.now(),
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

  /**
   * Clean up all cached URLs
   */
  clearCachedFileUrls: () => {
    for (const [key, { url }] of filesApi.cachedFileUrls.entries()) {
      URL.revokeObjectURL(url);
    }
    filesApi.cachedFileUrls.clear();
  },
  
  /**
   * Search files by name
   * Uses a regex to search for the query string in filenames
   */
  searchFiles: async (
    token: string,
    query: string,
    userId: string,
    masterKey?: string
  ): Promise<File[]> => {
    const files = await filesApi.getFiles(token, null, true, "all", query);
    
    // If we have a master key and results, try to decrypt file names for display
    if (masterKey && files.files.length > 0) {
      return files.files.map(file => {
        if (file.metadataEncrypted) {
          const decryptedName = userEncryptionService.decryptName(file.name, masterKey);
          return {
            ...file,
            originalName: decryptedName || file.name
          };
        }
        return file;
      });
    }
    
    return files.files;
  }
};

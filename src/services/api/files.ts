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

    const response = await handleResponse<CachedFilesData>(await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }));
    
    // We don't need to decrypt metadata here as that happens on the server
    return response;
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
    
    // Create a new FormData with encrypted files
    const encryptedFormData = new FormData();
    
    // Extract files from formData
    const files = formData.getAll('files');
    
    // Process each file
    for (let i = 0; i < files.length; i++) {
      const file = files[i] as File;
      
      try {
        // Encrypt file
        const encryptedFile = await encryptionService.encryptFile(file, encryptionKey);
        
        // Store original file type and name in metadata
        const fileMetadata = JSON.stringify({
          originalType: file.type,
          name: file.name
        });
        
        // Encrypt metadata
        const encryptedMetadata = encryptionService.encryptData(fileMetadata, encryptionKey);
        
        // Create a new file object with the encrypted data
        const encryptedFileObj = new Blob([encryptedFile], { type: 'application/encrypted' });
        
        // Add encrypted file to form data
        encryptedFormData.append('files', encryptedFileObj, file.name);
        encryptedFormData.append('encryptedMetadata', encryptedMetadata);
      } catch (error) {
        console.error('Error encrypting file:', error);
      }
    }
    
    if (folderId) {
      encryptedFormData.append("folderId", folderId);
    }

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_URL}/files/upload`);

    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const percent = Math.round((event.loaded / event.total) * 100);
        setUploadProgress(percent);
      }
    };

    xhr.onloadstart = () => setIsUploading(true);
    xhr.onloadend = () => setIsUploading(false);

    xhr.onreadystatechange = () => {
      if (xhr.readyState === 4 && xhr.status === 200) {
        console.log("Upload complete:", xhr.responseText);
      }
    };

    xhr.send(encryptedFormData);
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
    const file = fileData.get('file') as Blob;
    
    // Encrypt the file
    const encryptedFile = await encryptionService.encryptFile(file, encryptionKey);
    
    // Create new FormData with encrypted file
    const encryptedFormData = new FormData();
    encryptedFormData.append('file', encryptedFile, 'encrypted-file');
    
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
    return encryptionService.decryptFile(encryptedBlob, encryptionKey, fileMetadata.type);
  },

  getFilePreviewUrl: (token: string, fileId: string): string => {
    return `${API_URL}/files/${fileId}/preview?token=${token}`;
  },
};


import { CachedFoldersData, Folder } from "@/types";
import { API_URL, handleResponse } from "./utils";
import { encryptionService } from "./encryption";

export const foldersApi = {
  getFolders: async (
    token: string,
    parentId: string | null = null,
    resetCache: boolean | false = false,
    userId: string | null = null
  ): Promise<CachedFoldersData> => {
    let url = new URL(`${API_URL}/folders`);

    if (parentId) {
      url.searchParams.set("parentId", parentId.toString());
    }

    if (resetCache) {
      url.searchParams.set("resetCache", "true");
    }

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    
    const data = await handleResponse<CachedFoldersData>(response);
    
    // Decrypt folder names if userId is provided
    if (userId && data.folders) {
      const encryptionKey = encryptionService.generateUserEncryptionKey(userId, token);
      
      // Try to decrypt each folder name
      data.folders = data.folders.map(folder => {
        if (folder.name && folder.name.length > 24) {
          try {
            const decryptedName = encryptionService.decryptData(folder.name, encryptionKey);
            // If decryption was successful and returned a non-empty string
            if (decryptedName) {
              return { ...folder, name: decryptedName };
            }
          } catch (error) {
            console.error(`Error decrypting folder name: ${error}`);
          }
        }
        return folder;
      });
    }
    
    return data;
  },

  createFolder: async (
    token: string,
    name: string,
    parentId: string | null = null,
    userId: string
  ): Promise<Folder> => {
    // Generate encryption key
    const encryptionKey = encryptionService.generateUserEncryptionKey(userId, token);
    
    // Encrypt the folder name
    const encryptedName = encryptionService.encryptData(name, encryptionKey);
    
    const response = await fetch(`${API_URL}/folders`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ 
        name: encryptedName, 
        parentId,
        isEncrypted: true 
      }),
    });
    
    const folder = await handleResponse<Folder>(response);
    
    // Return the folder with the decrypted name for immediate use
    return { ...folder, name };
  },

  deleteFolder: async (token: string, folderId: string): Promise<void> => {
    const response = await fetch(`${API_URL}/folders/${folderId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return handleResponse<void>(response);
  },
};

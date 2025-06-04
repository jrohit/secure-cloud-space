
import { ApiError, AuthResponse, File, Folder, User } from "@/types";

const API_URL = "http://localhost:5000/api";

// Helper function to handle API responses
async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = await response.json();
    throw {
      message: error.message || "Something went wrong",
      status: response.status,
    } as ApiError;
  }
  return response.json() as Promise<T>;
}

// Auth API
export const authApi = {
  login: async (email: string, password: string): Promise<AuthResponse> => {
    const response = await fetch(`${API_URL}/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    });
    return handleResponse<AuthResponse>(response);
  },

  register: async (userData: { name: string; email: string; password: string; encryptedMasterKey: string }): Promise<AuthResponse> => {
    const response = await fetch(`${API_URL}/auth/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(userData),
    });
    return handleResponse<AuthResponse>(response);
  },

  getCurrentUser: async (token: string): Promise<User> => {
    const response = await fetch(`${API_URL}/auth/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return handleResponse<User>(response);
  },
};

// Files API
export const filesApi = {
  getFiles: async (token: string, folderId: string | null = null, searchQuery?: string): Promise<File[]> => {
    const params = new URLSearchParams();
    if (folderId) {
      params.append('folderId', folderId);
    }
    if (searchQuery && searchQuery.trim() !== '') {
      params.append('searchQuery', searchQuery.trim());
    }
    const queryString = params.toString();
    const url = `${API_URL}/files${queryString ? `?${queryString}` : ''}`;
    
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return handleResponse<File[]>(response);
  },

  restoreAllFromTrash: async (token: string): Promise<{ message: string; restoredCount: number }> => {
    const response = await fetch(`${API_URL}/files/trash/restore-all`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    return handleResponse<{ message: string; restoredCount: number }>(response);
  },

  uploadFile: async (token: string, encryptedFileBlob: Blob, fileName: string, originalMimeType: string, folderId: string | null = null): Promise<File> => {
    const formData = new FormData();
    formData.append('file', encryptedFileBlob, fileName);
    formData.append('originalMimeType', originalMimeType); // Add this line

    if (folderId) {
      formData.append("folderId", folderId);
    }
    
    const response = await fetch(`${API_URL}/files/upload`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        // 'Content-Type': 'multipart/form-data' is automatically set by the browser for FormData
      },
      body: formData,
    });
    return handleResponse<File>(response);
  },

  // Renamed from deleteFile to trashFile to reflect soft delete
  trashFile: async (token: string, fileId: string): Promise<void> => {
    const response = await fetch(`${API_URL}/files/${fileId}`, {
      method: 'DELETE', // This is the soft delete endpoint now
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    return handleResponse<void>(response);
  },

  restoreFile: async (token: string, fileId: string): Promise<File> => {
    const response = await fetch(`${API_URL}/files/${fileId}/restore`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    return handleResponse<File>(response);
  },

  getTrashedFiles: async (token: string): Promise<File[]> => {
    // Mocked for current subtask - TrashPage.tsx uses local mock data for display
    console.log(`Mock API: Getting trashed files with token ${token}`);
    await new Promise(resolve => setTimeout(resolve, 500));
    return []; // Return empty array as TrashPage uses its own mock display data
  },

  deleteFilePermanently: async (token: string, fileId: string): Promise<void> => {
    const response = await fetch(`${API_URL}/files/${fileId}/permanent`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    return handleResponse<void>(response);
  },

  emptyTrash: async (token: string): Promise<{ message: string; count: number; freedSpace: number }> => {
    const response = await fetch(`${API_URL}/files/trash/empty`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    return handleResponse<{ message: string; count: number; freedSpace: number }>(response);
  },

  downloadFile: async (token: string, fileId: string): Promise<Blob> => {
    const response = await fetch(`${API_URL}/files/${fileId}/download`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return response.blob();
  },

  toggleStarFile: async (token: string, fileId: string): Promise<File> => {
    const response = await fetch(`${API_URL}/files/${fileId}/star`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json' // Though no body is sent, it's good practice
      },
      // No body is needed for a simple toggle
    });
    return handleResponse<File>(response); // Assuming handleResponse is a generic helper
  },

  getStarredFiles: async (token: string): Promise<File[]> => {
    const response = await fetch(`${API_URL}/files/special/starred`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    return handleResponse<File[]>(response);
  },

  renameFile: async (token: string, fileId: string, newName: string): Promise<File> => {
    // Mocked implementation
    console.log(`Mock renaming file ${fileId} to ${newName} with token ${token}`);
    // Simulate an API call delay
    await new Promise(resolve => setTimeout(resolve, 500));
    // In a real scenario, you would fetch the file, then return it or the updated version from API
    // For now, we'll just return a dummy updated file object.
    // This requires knowing the structure of 'File', which we assume is available.
    // And we'd need to find the file in some local state or fetch it if not mocking.
    // For a pure mock, we can't update global state here, so Dashboard.tsx will handle state update.
    return {
      _id: fileId,
      name: newName,
      updatedAt: new Date().toISOString(),
      // Ensure all other required fields from the File type are present
      type: 'mock/type',
      size: 0,
      path: '/mock/path',
      folderId: null,
      userId: 'mock-user',
      createdAt: new Date().toISOString(),
      isStarred: false,
      displayPath: '/Mock Path',
      trashedAt: null,
    } as File; // Cast to File type to satisfy Promise<File>
  },

  moveFile: async (token: string, fileId: string, newParentId: string | null): Promise<File> => {
    // Mocked implementation
    console.log(`Mock moving file ${fileId} to new parent ${newParentId} with token ${token}`);
    await new Promise(resolve => setTimeout(resolve, 500));
    // This mock assumes the file's other properties remain the same,
    // but 'folderId' (representing parentId) and 'updatedAt' change.
    // The actual File object would need to be fetched or passed to update realistically.
    return {
      _id: fileId,
      name: 'Moved File Mock', // Name might not change, but to show it's a mock
      folderId: newParentId,
      updatedAt: new Date().toISOString(),
      // Fill in other required fields for the File type
      type: 'mock/type',
      size: 0,
      path: '/mock/path',
      userId: 'mock-user',
      createdAt: new Date().toISOString(), // Should be original creation date
      isStarred: false,
      displayPath: newParentId ? `/mock-parent/${newParentId}/Moved File Mock` : '/Moved File Mock',
      trashedAt: null,
    } as File;
  },
};

// Folders API
export const foldersApi = {
  getFolders: async (token: string, parentId: string | null = null): Promise<Folder[]> => {
    const url = parentId ? 
      `${API_URL}/folders?parentId=${parentId}` : 
      `${API_URL}/folders`;
    
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return handleResponse<Folder[]>(response);
  },

  createFolder: async (token: string, name: string, parentId: string | null = null): Promise<Folder> => {
    const response = await fetch(`${API_URL}/folders`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name, parentId }),
    });
    return handleResponse<Folder>(response);
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

  renameFolder: async (token: string, folderId: string, newName: string): Promise<Folder> => {
    // Mocked implementation
    console.log(`Mock renaming folder ${folderId} to ${newName} with token ${token}`);
    // Simulate an API call delay
    await new Promise(resolve => setTimeout(resolve, 500));
    // Similar to renameFile, this is a mock. Dashboard.tsx will handle actual state update.
    return {
      _id: folderId,
      name: newName,
      updatedAt: new Date().toISOString(),
      // Ensure all other required fields from the Folder type are present
      parentId: null,
      userId: 'mock-user',
      createdAt: new Date().toISOString(),
    } as Folder; // Cast to Folder type
  },

  moveFolder: async (token: string, folderId: string, newParentId: string | null): Promise<Folder> => {
    // Mocked implementation
    console.log(`Mock moving folder ${folderId} to new parent ${newParentId} with token ${token}`);
    await new Promise(resolve => setTimeout(resolve, 500));
    // This mock assumes the folder's other properties remain the same,
    // but 'parentId' and 'updatedAt' change.
    return {
      _id: folderId,
      name: 'Moved Folder Mock', // Name might not change
      parentId: newParentId,
      updatedAt: new Date().toISOString(),
      // Fill in other required fields for the Folder type
      userId: 'mock-user',
      createdAt: new Date().toISOString(), // Should be original creation date
    } as Folder;
  },

  permanentlyDeleteTrashedFolder: async (token: string, folderId: string): Promise<void> => {
    // Mocked implementation
    console.log(`Mock permanently deleting folder ${folderId} with token ${token}`);
    await new Promise(resolve => setTimeout(resolve, 500));
    // No return value needed for a successful void promise
    return Promise.resolve();
  },

  restoreFolder: async (token: string, folderId: string): Promise<Folder> => {
    console.log(`Mock API: Restoring folder ${folderId} with token ${token}`);
    await new Promise(resolve => setTimeout(resolve, 500));
    // Return a basic Folder-like object indicating success
    // Ensure all required fields from the Folder type are present
    return {
      _id: folderId,
      name: "Restored Folder Mock",
      parentId: null,
      userId: 'mock-user-id',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      // Add any other fields that your Folder type might have, e.g., trashedAt: null
    } as Folder;
  },

  getTrashedFolders: async (token: string): Promise<Folder[]> => {
    // Mocked for current subtask
    console.log(`Mock API: Getting trashed folders with token ${token}`);
    await new Promise(resolve => setTimeout(resolve, 500));
    return []; // Return empty array
  },
};

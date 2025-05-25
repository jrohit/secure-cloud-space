
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

  deleteFile: async (token: string, fileId: string): Promise<void> => {
    const response = await fetch(`${API_URL}/files/${fileId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return handleResponse<void>(response);
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
};

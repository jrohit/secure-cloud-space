import { ApiError, AuthResponse, File, Folder, User } from "@/types";

const API_URL = "http://localhost:5000/api";

// Helper function to handle API responses
async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const errorText = await response.text(); // Read as text first to avoid JSON parse error if not JSON
    try {
      const errorJson = JSON.parse(errorText);
      throw {
        message: errorJson.message || "Something went wrong",
        status: response.status,
      } as ApiError;
    } catch (e) {
      // If parsing as JSON fails, use the raw text or a generic message
      throw {
        message: errorText || "Something went wrong",
        status: response.status,
      } as ApiError;
    }
  }
  // Handle cases where response might be empty (e.g., 204 No Content)
  const contentType = response.headers.get("content-type");
  if (contentType && contentType.indexOf("application/json") !== -1) {
    return response.json() as Promise<T>;
  } else {
    // For non-JSON responses (like simple text or empty 204), resolve with null or a specific type
    // For void promises, this is fine. For others, might need adjustment.
    return Promise.resolve(null as unknown as T);
  }
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

  register: async (userData: {
    name: string;
    email: string;
    password: string;
    encryptedMasterKey: string;
  }): Promise<AuthResponse> => {
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

  // Renamed and reworked to handle file upload for avatar
  uploadAndSetAvatar: async (userId: string, file: File, token: string): Promise<User> => {
    // userId might not be strictly necessary if the backend uses the token to identify the user for '/auth/me/avatar'
    console.log(`Calling API to upload avatar for user ${userId}: ${file.name}`);

    const formData = new FormData();
    formData.append('avatar', file, file.name); // 'avatar' is the field name the backend expects for the file

    const response = await fetch(`${API_URL}/auth/me/avatar`, { // Dedicated endpoint for avatar upload
      method: 'POST', // Or PATCH, depending on API design for file uploads affecting user profile
      headers: {
        // 'Content-Type': 'multipart/form-data' is automatically set by the browser when FormData is used as the body.
        'Authorization': `Bearer ${token}`,
      },
      body: formData,
    });

    return handleResponse<User>(response); // Expects the updated User object from the backend
  },
  // Note: If there was other profile data to update (e.g., name, email as text fields),
  // a separate updateUserProfile function sending JSON could be maintained or created.
  // This change focuses on making avatar updates use FormData.
};

// Files API
export const filesApi = {
  getFiles: async (
    token: string,
    folderId: string | null = null,
    searchQuery?: string,
    page?: number,
    limit?: number,
    cacheBuster?: string // New optional parameter
  ): Promise<{
    files: File[];
    totalCount: number;
    currentPage: number;
    totalPages: number;
  }> => {
    const params = new URLSearchParams();
    if (folderId) {
      params.append("folderId", folderId);
    }
    if (searchQuery && searchQuery.trim() !== "") {
      params.append("searchQuery", searchQuery.trim());
    }
    if (page !== undefined) {
      params.append("page", page.toString());
    }
    if (limit !== undefined) {
      params.append("limit", limit.toString());
    }
    if (cacheBuster) {
      params.append("resetCache", cacheBuster);
    }
    const queryString = params.toString();
    const url = `${API_URL}/files${queryString ? `?${queryString}` : ""}`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return handleResponse<{
      files: File[];
      totalCount: number;
      currentPage: number;
      totalPages: number;
    }>(response);
  },

  restoreAllFromTrash: async (
    token: string
  ): Promise<{ message: string; restoredCount: number }> => {
    const response = await fetch(`${API_URL}/files/trash/restore-all`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return handleResponse<{ message: string; restoredCount: number }>(response);
  },

  uploadFile: async (
    token: string,
    encryptedFileBlob: Blob,
    fileName: string,
    originalMimeType: string,
    folderId: string | null = null
  ): Promise<File> => {
    const formData = new FormData();
    formData.append("file", encryptedFileBlob, fileName);
    formData.append("originalMimeType", originalMimeType);

    if (folderId) {
      formData.append("folderId", folderId);
    }

    const response = await fetch(`${API_URL}/files/upload`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });
    return handleResponse<File>(response);
  },

  trashFile: async (
    token: string,
    fileId: string
  ): Promise<{ message: string }> => {
    // Backend sends a message
    const response = await fetch(`${API_URL}/files/${fileId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return handleResponse<{ message: string }>(response);
  },

  restoreFile: async (
    token: string,
    fileId: string
  ): Promise<{ message: string; file: File; restoredToRoot: boolean }> => {
    const response = await fetch(`${API_URL}/files/${fileId}/restore`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return handleResponse<{ message: string; file: File }>(response);
  },

  getTrashedFiles: async (token: string): Promise<File[]> => {
    const response = await fetch(`${API_URL}/files/trash`, {
      // UPDATED URL
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return handleResponse<File[]>(response);
  },

  deleteFilePermanently: async (
    token: string,
    fileId: string
  ): Promise<{ message: string }> => {
    // Backend sends a message
    const response = await fetch(`${API_URL}/files/${fileId}/permanent`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return handleResponse<{ message: string }>(response);
  },

  emptyTrash: async (
    token: string
  ): Promise<{ message: string; count: number; freedSpace: number }> => {
    const response = await fetch(`${API_URL}/files/trash/empty`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return handleResponse<{
      message: string;
      count: number;
      freedSpace: number;
    }>(response);
  },

  downloadFile: async (token: string, fileId: string): Promise<Blob> => {
    const response = await fetch(`${API_URL}/files/${fileId}/download`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) {
      const error = await response.json();
      throw {
        message: error.message || "Download failed",
        status: response.status,
      } as ApiError;
    }
    return response.blob();
  },

  toggleStarFile: async (token: string, fileId: string): Promise<File> => {
    const response = await fetch(`${API_URL}/files/${fileId}/star`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return handleResponse<File>(response);
  },

  getStarredFiles: async (token: string): Promise<File[]> => {
    const response = await fetch(`${API_URL}/files/special/starred`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return handleResponse<File[]>(response);
  },

  renameFile: async (
    token: string,
    fileId: string,
    newName: string
  ): Promise<File> => {
    // This should be a PATCH request in a real API
    console.log(
      `Mock renaming file ${fileId} to ${newName} with token ${token}`
    );
    await new Promise((resolve) => setTimeout(resolve, 500));
    return {
      _id: fileId,
      name: newName,
      updatedAt: new Date().toISOString(),
      type: "mock/type",
      size: 0,
      path: "/mock/path",
      folderId: null,
      userId: "mock-user",
      createdAt: new Date().toISOString(),
      isStarred: false,
      displayPath: "/Mock Path",
      trashedAt: null,
      isTrashed: false,
    } as File;
  },

  moveFile: async (
    token: string,
    fileId: string,
    newParentId: string | null
  ): Promise<File> => {
    // This should be a PATCH request in a real API
    console.log(
      `Mock moving file ${fileId} to new parent ${newParentId} with token ${token}`
    );
    await new Promise((resolve) => setTimeout(resolve, 500));
    return {
      _id: fileId,
      name: "Moved File Mock",
      folderId: newParentId,
      updatedAt: new Date().toISOString(),
      type: "mock/type",
      size: 0,
      path: "/mock/path",
      userId: "mock-user",
      createdAt: new Date().toISOString(),
      isStarred: false,
      displayPath: newParentId
        ? `/mock-parent/${newParentId}/Moved File Mock`
        : "/Moved File Mock",
      trashedAt: null,
      isTrashed: false,
    } as File;
  },
};

// Folders API
export const foldersApi = {
  getFolders: async (
    token: string,
    parentId: string | null = null,
    cacheBuster?: string // New optional parameter
  ): Promise<Folder[]> => {
    const params = new URLSearchParams();
    if (parentId) {
      params.append("parentId", parentId);
    }
    if (cacheBuster) {
      params.append("_cb", cacheBuster);
    }
    const queryString = params.toString();
    const url = `${API_URL}/folders${queryString ? `?${queryString}` : ""}`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return handleResponse<Folder[]>(response);
  },

  createFolder: async (
    token: string,
    name: string,
    parentId: string | null = null
  ): Promise<Folder> => {
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

  // This now represents moving a folder to trash (soft delete)
  deleteFolder: async (
    token: string,
    folderId: string
  ): Promise<{ message: string }> => {
    const response = await fetch(`${API_URL}/folders/${folderId}`, {
      method: "DELETE", // Backend for this endpoint now performs soft delete
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return handleResponse<{ message: string }>(response); // Backend sends a message
  },

  renameFolder: async (
    token: string,
    folderId: string,
    newName: string
  ): Promise<Folder> => {
    // This should be a PATCH request in a real API
    console.log(
      `Mock renaming folder ${folderId} to ${newName} with token ${token}`
    );
    await new Promise((resolve) => setTimeout(resolve, 500));
    return {
      _id: folderId,
      name: newName,
      updatedAt: new Date().toISOString(),
      parentId: null,
      userId: "mock-user",
      createdAt: new Date().toISOString(),
      isTrashed: false,
      trashedAt: null,
    } as Folder;
  },

  moveFolder: async (
    token: string,
    folderId: string,
    newParentId: string | null
  ): Promise<Folder> => {
    // This should be a PATCH request in a real API
    console.log(
      `Mock moving folder ${folderId} to new parent ${newParentId} with token ${token}`
    );
    await new Promise((resolve) => setTimeout(resolve, 500));
    return {
      _id: folderId,
      name: "Moved Folder Mock",
      parentId: newParentId,
      updatedAt: new Date().toISOString(),
      userId: "mock-user",
      createdAt: new Date().toISOString(),
      isTrashed: false,
      trashedAt: null,
    } as Folder;
  },

  permanentlyDeleteTrashedFolder: async (
    token: string,
    folderId: string
  ): Promise<{ message: string }> => {
    const response = await fetch(`${API_URL}/folders/${folderId}/permanent`, {
      // IMPLEMENTED
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return handleResponse<{ message: string }>(response);
  },

  restoreFolder: async (
    token: string,
    folderId: string
  ): Promise<{ message: string; folder: Folder; restoredToRoot: boolean }> => {
    const response = await fetch(`${API_URL}/folders/${folderId}/restore`, {
      // IMPLEMENTED
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return handleResponse<{ message: string; folder: Folder }>(response);
  },

  getTrashedFolders: async (token: string): Promise<Folder[]> => {
    const response = await fetch(`${API_URL}/folders/trash`, {
      // UPDATED URL
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return handleResponse<Folder[]>(response);
  },

  emptyTrash: async (
    token: string
  ): Promise<{
    message: string;
    foldersDeleted?: number;
    spaceFreed?: string;
  }> => {
    // NEW FUNCTION
    const response = await fetch(`${API_URL}/folders/trash/empty`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return handleResponse<{
      message: string;
      foldersDeleted?: number;
      spaceFreed?: string;
    }>(response);
  },
};

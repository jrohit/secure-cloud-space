import {
  ApiError,
  AuthResponse,
  CachedFilesData,
  CachedFoldersData,
  File,
  Folder,
  User,
} from "@/types";

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

  register: async (
    name: string,
    email: string,
    password: string
  ): Promise<AuthResponse> => {
    const response = await fetch(`${API_URL}/auth/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name, email, password }),
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
  getFiles: async (
    token: string,
    folderId: string | null = null,
    resetCache: boolean | false = false
  ): Promise<CachedFilesData> => {
    let url = new URL(`${API_URL}/files`);

    if (folderId) {
      url.searchParams.set("folderId", folderId.toString());
    }

    if (resetCache) {
      url.searchParams.set("resetCache", "true");
    }

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return handleResponse<CachedFilesData>(response);
  },

  multipleFileUpload: async ({
    token,
    formData,
    folderId,
    setUploadProgress,
    setIsUploading,
  }: {
    token: any;
    formData: XMLHttpRequestBodyInit | Document;
    folderId: string | null;
    setUploadProgress: (arg0: number) => void;
    setIsUploading: (arg0: boolean) => any;
  }) => {
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

    xhr.send(formData);
  },

  uploadFile: async (
    token: string,
    file: FormData,
    folderId: string | null = null
  ): Promise<File> => {
    if (folderId) {
      file.append("folderId", folderId);
    }

    const response = await fetch(`${API_URL}/files/upload`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: file,
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
};

// Folders API
export const foldersApi = {
  getFolders: async (
    token: string,
    parentId: string | null = null,
    resetCache: boolean | false = false
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
    return handleResponse<CachedFoldersData>(response);
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

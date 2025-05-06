
import { CachedFilesData, File, StorageInfo } from "@/types";
import { API_URL, handleResponse } from "./utils";

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

  getFilePreviewUrl: (token: string, fileId: string): string => {
    return `${API_URL}/files/${fileId}/preview?token=${token}`;
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

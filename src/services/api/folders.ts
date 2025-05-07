
import { CachedFilesData, Folder } from "@/types";
import { API_URL, handleResponse } from "./utils";

export const foldersApi = {
  /**
   * Get folders based on parentId
   */
  getFolders: async (
    token: string,
    parentId: string | null = null,
    resetCache: boolean = false,
    userId: string = ""
  ): Promise<{ folders: Folder[] }> => {
    let url = new URL(`${API_URL}/folders`);

    if (parentId) {
      url.searchParams.set("parentId", parentId);
    }

    if (resetCache) {
      url.searchParams.set("resetCache", "true");
    }

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return handleResponse<{ folders: Folder[] }>(response);
  },

  /**
   * Create a new folder
   */
  createFolder: async (
    token: string,
    name: string,
    parentId: string | null = null,
    userId: string = "",
    metadataEncrypted: boolean = false
  ): Promise<Folder> => {
    const response = await fetch(`${API_URL}/folders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        name,
        parentId,
        metadataEncrypted
      }),
    });
    return handleResponse<Folder>(response);
  },

  /**
   * Delete a folder
   */
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

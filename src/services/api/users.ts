
import { StoragePlan, User } from "@/types";
import { API_URL, handleResponse } from "./utils";

export const usersApi = {
  getProfile: async (token: string): Promise<User> => {
    const response = await fetch(`${API_URL}/users/profile`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return handleResponse<User>(response);
  },

  uploadAvatar: async (token: string, avatarFile: Blob): Promise<{ user: User }> => {
    const formData = new FormData();
    formData.append('avatar', avatarFile);

    const response = await fetch(`${API_URL}/users/avatar`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });
    return handleResponse<{ user: User }>(response);
  },

  deleteAvatar: async (token: string): Promise<void> => {
    const response = await fetch(`${API_URL}/users/avatar`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return handleResponse<void>(response);
  },

  getStoragePlans: async (token: string): Promise<StoragePlan[]> => {
    const response = await fetch(`${API_URL}/users/storage-plans`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return handleResponse<StoragePlan[]>(response);
  },

  upgradeStorage: async (token: string, planId: string): Promise<{ storageLimit: number, storageType: string }> => {
    const response = await fetch(`${API_URL}/users/upgrade-storage`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ planId }),
    });
    return handleResponse<{ storageLimit: number, storageType: string }>(response);
  },
};

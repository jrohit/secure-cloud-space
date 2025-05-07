
import { User, StoragePlan } from "@/types";
import { API_URL, handleResponse } from "./utils";

export interface ProfileUpdateRequest {
  name?: string;
  email?: string;
}

export interface PasswordUpdateRequest {
  currentPassword: string;
  newPassword: string;
  encryptedMasterKey?: string;
  iv?: string;
  tag?: string;
}

export const userApi = {
  /**
   * Get current user profile
   */
  getProfile: async (token: string): Promise<User> => {
    const response = await fetch(`${API_URL}/users/profile`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return handleResponse<User>(response);
  },

  /**
   * Update user profile
   */
  updateProfile: async (token: string, data: ProfileUpdateRequest): Promise<User> => {
    const response = await fetch(`${API_URL}/users/profile`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });
    return handleResponse<User>(response);
  },

  /**
   * Update password
   */
  updatePassword: async (token: string, data: PasswordUpdateRequest): Promise<User> => {
    const response = await fetch(`${API_URL}/users/password`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });
    return handleResponse<User>(response);
  },

  /**
   * Get available storage plans
   */
  getStoragePlans: async (token: string): Promise<StoragePlan[]> => {
    const response = await fetch(`${API_URL}/users/storage-plans`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return handleResponse<StoragePlan[]>(response);
  },

  /**
   * Upgrade storage plan
   */
  upgradeStoragePlan: async (token: string, planId: string): Promise<User> => {
    const response = await fetch(`${API_URL}/users/upgrade-storage`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ planId }),
    });
    return handleResponse<User>(response);
  },
};

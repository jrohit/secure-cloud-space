
import { User } from "@/types";
import { API_URL, handleResponse } from "./utils";

export const authApi = {
  login: async (
    email: string,
    password: string
  ): Promise<{ user: User; token: string }> => {
    const response = await fetch(`${API_URL}/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    });
    return handleResponse<{ user: User; token: string }>(response);
  },

  signup: async (
    name: string,
    email: string,
    password: string,
    encryptedMasterKey?: string,
    salt?: string,
    iv?: string,
    tag?: string
  ): Promise<{ user: User; token: string }> => {
    const response = await fetch(`${API_URL}/auth/signup`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ 
        name, 
        email, 
        password,
        encryptedMasterKey,
        salt,
        iv,
        tag
      }),
    });
    return handleResponse<{ user: User; token: string }>(response);
  },

  getCurrentUser: async (token: string): Promise<User> => {
    const response = await fetch(`${API_URL}/auth/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return handleResponse<User>(response);
  },

  updatePassword: async (
    token: string,
    currentPassword: string,
    newPassword: string,
    encryptedMasterKey: string,
    iv: string,
    tag: string
  ): Promise<User> => {
    const response = await fetch(`${API_URL}/auth/update-password`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        currentPassword,
        newPassword,
        encryptedMasterKey,
        iv,
        tag,
      }),
    });
    return handleResponse<User>(response);
  },
};

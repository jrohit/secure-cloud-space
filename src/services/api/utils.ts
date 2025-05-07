
import { ApiError } from "@/types";

export const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

export async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let error: ApiError = {
      message: "An error occurred",
      status: response.status,
    };

    try {
      const errorData = await response.json();
      error = {
        message: errorData.message || error.message,
        status: response.status,
      };
    } catch (e) {
      console.error("Failed to parse error response", e);
    }

    throw error;
  }

  return response.json() as Promise<T>;
}

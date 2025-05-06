
import { ApiError } from "@/types";

export const API_URL = "http://localhost:5000/api";

// Helper function to handle API responses
export async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = await response.json();
    throw {
      message: error.message || "Something went wrong",
      status: response.status,
    } as ApiError;
  }
  return response.json() as Promise<T>;
}

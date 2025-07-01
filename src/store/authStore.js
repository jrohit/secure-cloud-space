import { create } from 'zustand';

// This store will hold the authentication state, including the sensitive raw master key.
// The raw master key should ONLY be kept in memory and never persisted to disk directly.
// It's cleared on logout.

const useAuthStore = create((set) => ({
  user: null, // User information from auth/me
  authToken: null, // JWT or similar token from login
  rawMasterKey: null, // ArrayBuffer: The decrypted master key, held in memory ONLY
  isLoading: false, // For loading states during auth operations
  error: null, // For storing auth errors

  // Action to set user data and token after successful login/registration
  loginSuccess: (userData, token, masterKey) => set({
    user: userData,
    authToken: token,
    rawMasterKey: masterKey,
    isLoading: false,
    error: null
  }),

  // Action to handle logout
  logout: () => set({
    user: null,
    authToken: null,
    rawMasterKey: null, // CRITICAL: Clear raw master key from memory
    error: null
  }),

  // Actions for loading and error states
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (errorMessage) => set({ error: errorMessage, isLoading: false }),

  // Action to update user info (e.g., after fetching from auth/me)
  setUser: (userData) => set({ user: userData }),

  // Action to set the raw master key (used during login process)
  // This is separated to emphasize its sensitivity.
  setRawMasterKey: (key) => set({ rawMasterKey: key }),
}));

export default useAuthStore;

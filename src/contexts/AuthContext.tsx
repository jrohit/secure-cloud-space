import React, {
  createContext,
  useState,
  useContext,
  useEffect,
  ReactNode,
  useCallback,
} from "react"; // Added useCallback
import { User } from "@/types";
import { authApi } from "@/services/api";
import { useToast } from "@/components/ui/use-toast";
import {
  decryptMasterKey,
  arrayBufferToBase64,
  base64ToArrayBuffer,
} from "@/lib/cryptoUtils"; // Added base64ToArrayBuffer

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  // decryptedMasterKey: CryptoKey | null; // Removed
  rawMasterKey: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (
    name: string,
    email: string,
    password: string,
    encryptedMasterKeyString: string,
  ) => Promise<void>;
  logout: () => void;
  getMasterCryptoKey: () => Promise<CryptoKey | null>; // Added
  refreshUserStorageInfo: () => Promise<void>; // Added
  updateUserAvatar: (newAvatarUrl: string) => void; // Added for avatar updates
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  // const [decryptedMasterKey, setDecryptedMasterKey] = useState<CryptoKey | null>(null); // Removed
  const [rawMasterKey, setRawMasterKey] = useState<string | null>(null);
  const [masterCryptoKey, setMasterCryptoKey] = useState<CryptoKey | null>(
    null,
  ); // This is the primary CryptoKey state now
  const { toast } = useToast();

  // Effect to manage masterCryptoKey based on rawMasterKey
  useEffect(() => {
    if (!rawMasterKey) {
      setMasterCryptoKey(null); // If rawMasterKey is cleared, clear the CryptoKey
    }
    // If rawMasterKey is present, masterCryptoKey will be set either by loadUser (proactively)
    // or by getMasterCryptoKey (reactively/on-demand).
    // No need to null it out here if rawMasterKey is present, as that would negate proactive loading.
  }, [rawMasterKey]);

  const getMasterCryptoKey =
    useCallback(async (): Promise<CryptoKey | null> => {
      if (masterCryptoKey) {
        return masterCryptoKey;
      }
      if (!rawMasterKey) {
        // console.warn("Cannot get master crypto key: rawMasterKey is not available.");
        return null;
      }
      try {
        const keyArrayBuffer = base64ToArrayBuffer(rawMasterKey);
        const importedKey = await window.crypto.subtle.importKey(
          "raw",
          keyArrayBuffer,
          { name: "AES-GCM", length: 256 }, // Specify length
          true, // extractable
          ["encrypt", "decrypt"],
        );
        setMasterCryptoKey(importedKey);
        return importedKey;
      } catch (error) {
        console.error("Error importing master key:", error);
        return null;
      }
    }, [rawMasterKey, masterCryptoKey]); // Dependency on masterCryptoKey state

  useEffect(() => {
    // Check if user is already logged in
    const storedToken = localStorage.getItem("token");
    if (storedToken) {
      setToken(storedToken);
      loadUser(storedToken);
    } else {
      setLoading(false);
    }
  }, []);

  const loadUser = async (authToken: string) => {
    try {
      const userData = await authApi.getCurrentUser(authToken);
      setUser(userData); // User is set here

      // Now, handle master key loading based on session/local storage
      const storedRawKey = sessionStorage.getItem("rawMasterKey");
      if (storedRawKey) {
        setRawMasterKey(storedRawKey); // Set the raw key state
        // Proactively generate and cache the CryptoKey
        try {
          const keyArrayBuffer = base64ToArrayBuffer(storedRawKey); // Use storedRawKey directly
          const importedKey = await window.crypto.subtle.importKey(
            "raw",
            keyArrayBuffer,
            { name: "AES-GCM", length: 256 }, // Specify length as in getMasterCryptoKey
            true, // extractable
            ["encrypt", "decrypt"],
          );
          setMasterCryptoKey(importedKey); // Directly set the CryptoKey state
        } catch (error) {
          console.error("Error importing master key during loadUser:", error);
          setMasterCryptoKey(null); // Ensure it's null if import fails
          // Potentially clear rawMasterKey from session/state too if it's corrupted? For now, stick to task.
        }
      } else {
        setRawMasterKey(null); // Clear raw key state if not found in session
        setMasterCryptoKey(null); // Also clear the CryptoKey state

        // Log if encrypted key is in localStorage (user might need to re-login)
        const storedEncryptedKey = localStorage.getItem("encryptedMasterKey");
        if (storedEncryptedKey && userData) {
          console.log(
            "Raw master key not in session, but encrypted key is available in localStorage. User may need to re-login to decrypt and use it.",
          );
        }
      }
    } catch (error) {
      console.error("Failed to load user:", error);
      localStorage.removeItem("token");
      setToken(null);
      toast({
        title: "Session expired",
        description: "Please log in again",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    setLoading(true);
    try {
      const loginResponse = await authApi.login(email, password); // Step 1: Login to get token
      setToken(loginResponse.token);
      localStorage.setItem("token", loginResponse.token);

      // Step 2: Fetch full user data using the token to get encryptedMasterKey
      const userData = await authApi.getCurrentUser(loginResponse.token);
      setUser(userData); // Set user from the more complete /me endpoint data

      // Step 3: Decrypt master key if present
      if (userData.encryptedMasterKey) {
        try {
          const decryptedKeyArrayBuffer = await decryptMasterKey(
            userData.encryptedMasterKey,
            password,
          );
          const decryptedKeyBase64 = arrayBufferToBase64(
            decryptedKeyArrayBuffer,
          );
          setRawMasterKey(decryptedKeyBase64);
          sessionStorage.setItem("rawMasterKey", decryptedKeyBase64);
          localStorage.setItem(
            "encryptedMasterKey",
            userData.encryptedMasterKey,
          );

          // The old setDecryptedMasterKey call and its related CryptoKey import are removed.
          // masterCryptoKey state will be set by getMasterCryptoKey on demand, or by loadUser.

          toast({
            title: "Secure session established.",
            description: "Master key decrypted and session secured.",
          });
        } catch (error) {
          console.error("Failed to decrypt master key during login:", error);
          setRawMasterKey(null);
          sessionStorage.removeItem("rawMasterKey");
          // localStorage.removeItem('encryptedMasterKey'); // Task: Don't store if decryption failed
          // setDecryptedMasterKey(null); // Removed
          toast({
            title: "Master Key Decryption Failed",
            description:
              "Could not decrypt your master key. Please check your password. Some features might be unavailable.",
            variant: "destructive",
          });
        }
      } else {
        console.warn(
          "User does not have an encryptedMasterKey. Skipping decryption.",
        );
        setRawMasterKey(null); // Ensure raw key is cleared
        // setDecryptedMasterKey(null); // Removed
      }

      toast({
        title: "Login successful",
        description: `Welcome back, ${userData.name}!`, // Use name from userData
      });
    } catch (error) {
      console.error("Login failed:", error);
      // setDecryptedMasterKey(null); // Removed
      toast({
        title: "Login failed",
        description: "Invalid email or password",
        variant: "destructive",
      });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const register = async (
    name: string,
    email: string,
    password: string,
    encryptedMasterKeyString: string,
  ) => {
    setLoading(true);
    try {
      const response = await authApi.register({
        name,
        email,
        password,
        encryptedMasterKey: encryptedMasterKeyString,
      });
      setUser(response.user);
      setToken(response.token);
      localStorage.setItem("token", response.token);
      toast({
        title: "Registration successful",
        description: `Welcome, ${response.user.name}!`,
      });
    } catch (error) {
      console.error("Registration failed:", error);
      toast({
        title: "Registration failed",
        description: "Email might already be in use",
        variant: "destructive",
      });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    // setDecryptedMasterKey(null); // Removed
    setRawMasterKey(null); // Clearing the raw master key string from state
    localStorage.removeItem("token");
    sessionStorage.removeItem("rawMasterKey"); // Clearing from session storage
    localStorage.removeItem("encryptedMasterKey"); // Clearing from local storage
    toast({
      title: "Logged out",
      description: "You have been logged out successfully",
    });
  };

  const refreshUserStorageInfo = useCallback(async () => {
    if (!token) {
      // console.warn("Cannot refresh user storage info: no token available.");
      return;
    }
    try {
      const updatedUserData = await authApi.getCurrentUser(token);
      setUser(updatedUserData); // This will update the user object in the context
    } catch (error) {
      console.error("Failed to refresh user storage info:", error);
      toast({
        title: "Update Failed",
        description: "Could not fetch the latest storage information.",
        variant: "destructive",
      });
    }
  }, [token, setUser, toast]); // Added dependencies for useCallback

  const updateUserAvatar = useCallback(async (newAvatarUrl: string) => {
    if (!user || !token) {
      toast({ title: "Error", description: "You must be logged in to update your avatar.", variant: "destructive" });
      return;
    }
    try {
      // Simulate backend call: Pass the newAvatarUrl (which is currently a blob URL)
      // A real backend would need the file uploaded, then URL to that file saved.
      // For this simulation, we pretend the blob URL is what we save.
      const updatedUserFromApi = await authApi.updateUserProfile(user.id, { avatarUrl: newAvatarUrl }, token);

      setUser(updatedUserFromApi); // Update context with user data from API response

      // Optionally, update localStorage if the full user object is stored there,
      // though this app seems to refetch user on load based on token.
      // if (updatedUserFromApi) {
      //   localStorage.setItem('user', JSON.stringify(updatedUserFromApi));
      // }

      toast({ title: "Avatar Updated", description: "Your avatar has been updated (simulated)." });
    } catch (error) {
      console.error("Failed to update avatar:", error);
      toast({ title: "Avatar Update Failed", description: "Could not update your avatar.", variant: "destructive" });
    }
  }, [user, token, setUser, toast]); // Ensure all dependencies are listed

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        // decryptedMasterKey, // Removed
        rawMasterKey,
        login,
        register,
        logout,
        getMasterCryptoKey, // Added
        refreshUserStorageInfo, // Added
        updateUserAvatar, // Added
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

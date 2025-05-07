
import React, { createContext, useState, useContext, useEffect } from "react";
import { User } from "@/types";
import { authApi } from "@/services/api/auth";
import { userEncryptionService } from "@/services/api/userEncryption";

interface AuthContextType {
  user: User | null;
  token: string | null;
  masterKey: string | null;
  loading: boolean; // Added loading property
  updateUserData: (user: User) => void; // Added to replace updateUser
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  register: (name: string, email: string, password: string) => Promise<void>; // Added register
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  masterKey: null,
  loading: true, // Initialize loading state
  updateUserData: () => {},
  login: async () => {},
  logout: () => {},
  register: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [masterKey, setMasterKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true); // Add loading state

  // Check if there's a stored token on component mount
  useEffect(() => {
    const storedToken = localStorage.getItem("token");
    if (storedToken) {
      setToken(storedToken);
      getCurrentUser(storedToken);
    } else {
      setLoading(false); // Important: Set loading to false when no token
    }
  }, []);

  const getCurrentUser = async (authToken: string) => {
    try {
      const userData = await authApi.getCurrentUser(authToken);
      setUser(userData);
      
      // Try to get master key from localStorage
      const cachedMasterKey = await userEncryptionService.getMasterKey(userData, authToken);
      setMasterKey(cachedMasterKey);
      
    } catch (error) {
      console.error("Error getting current user:", error);
      logout();
    } finally {
      setLoading(false); // Important: Set loading to false after fetch completes
    }
  };

  const login = async (email: string, password: string) => {
    try {
      setLoading(true);
      const { user: userData, token: authToken } = await authApi.login(email, password);
      
      // Store in state
      setUser(userData);
      setToken(authToken);
      
      // Store in localStorage
      localStorage.setItem("token", authToken);
      
      // Try to decrypt the master key with password
      if (userData.encryptedMasterKey && userData.salt && userData.iv && userData.tag) {
        try {
          const decryptedMasterKey = userEncryptionService.decryptMasterKey(
            {
              ciphertext: userData.encryptedMasterKey,
              iv: userData.iv, 
              tag: userData.tag
            }, 
            password, 
            userData.salt
          );
          
          // Store master key in memory and localStorage
          setMasterKey(decryptedMasterKey);
          userEncryptionService.saveMasterKey(userData.id, decryptedMasterKey);
        } catch (error) {
          console.error("Failed to decrypt master key:", error);
          // Continue login process even if master key decryption fails
        }
      }
    } catch (error) {
      console.error("Login error:", error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const register = async (name: string, email: string, password: string) => {
    try {
      setLoading(true);
      
      // Generate encryption parameters for the user's master key
      const { 
        masterKey: newMasterKey, 
        encryptedMasterKey, 
        salt, 
        iv, 
        tag 
      } = userEncryptionService.generateMasterKeyAndParams(password);
      
      // Register the user with the generated encryption parameters
      const { user: userData, token: authToken } = await authApi.signup(
        name,
        email,
        password,
        encryptedMasterKey,
        salt,
        iv,
        tag
      );
      
      // Store user data and token
      setUser(userData);
      setToken(authToken);
      localStorage.setItem("token", authToken);
      
      // Store master key in memory and localStorage
      setMasterKey(newMasterKey);
      userEncryptionService.saveMasterKey(userData.id, newMasterKey);
      
    } catch (error) {
      console.error("Registration error:", error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    setMasterKey(null);
    localStorage.removeItem("token");
    
    // Clear any master keys from localStorage
    if (user) {
      userEncryptionService.clearMasterKey(user.id);
    }
  };
  
  const updateUserData = (updatedUser: User) => {
    setUser(updatedUser);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        masterKey,
        loading,
        updateUserData,
        login,
        logout,
        register,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

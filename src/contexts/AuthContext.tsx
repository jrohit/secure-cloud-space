
import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { User } from "@/types";
import { authApi } from "@/services/api";
import { userEncryptionService } from "@/services/api/userEncryption";

interface AuthContextType {
  user: User | null;
  token: string | null;
  masterKey: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<User>;
  signup: (name: string, email: string, password: string) => Promise<User>;
  logout: () => void;
  setUserMasterKey: (masterKey: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [masterKey, setMasterKey] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check for existing auth on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const storedToken = localStorage.getItem("token");
        if (storedToken) {
          const userData = await authApi.getCurrentUser(storedToken);
          setUser(userData);
          setToken(storedToken);
          
          // Try to get master key from localStorage
          const cachedMasterKey = await userEncryptionService.getMasterKey(userData, storedToken);
          if (cachedMasterKey) {
            setMasterKey(cachedMasterKey);
          }
        }
      } catch (error) {
        console.error("Authentication error:", error);
        // Clear any invalid auth data
        localStorage.removeItem("token");
        setUser(null);
        setToken(null);
        setMasterKey(null);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const { user, token } = await authApi.login(email, password);
      
      // Get user's encryption details from user object
      if (user.salt && user.iv && user.tag && user.encryptedMasterKey) {
        try {
          // Decrypt the master key with the user's password
          const decryptedMasterKey = userEncryptionService.decryptMasterKey(
            { 
              iv: user.iv, 
              ciphertext: user.encryptedMasterKey, 
              tag: user.tag 
            },
            password,
            user.salt
          );
          
          // Save master key to state and localStorage
          setMasterKey(decryptedMasterKey);
          userEncryptionService.saveMasterKey(user.id, decryptedMasterKey);
        } catch (error) {
          console.error("Failed to decrypt master key:", error);
        }
      }
      
      localStorage.setItem("token", token);
      setUser(user);
      setToken(token);
      return user;
    } catch (error) {
      console.error("Login error:", error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const signup = async (name: string, email: string, password: string) => {
    setIsLoading(true);
    try {
      // Generate encryption keys and parameters
      const { 
        masterKey: newMasterKey,
        encryptedMasterKey,
        salt,
        iv,
        tag
      } = userEncryptionService.generateMasterKeyAndParams(password);
      
      // Register user with encryption parameters
      const { user, token } = await authApi.signup(
        name, 
        email, 
        password, 
        encryptedMasterKey,
        salt,
        iv,
        tag
      );
      
      // Set master key in state and localStorage
      setMasterKey(newMasterKey);
      userEncryptionService.saveMasterKey(user.id, newMasterKey);
      
      localStorage.setItem("token", token);
      setUser(user);
      setToken(token);
      return user;
    } catch (error) {
      console.error("Signup error:", error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    if (user) {
      userEncryptionService.clearMasterKey(user.id);
    }
    localStorage.removeItem("token");
    setUser(null);
    setToken(null);
    setMasterKey(null);
  };

  const setUserMasterKey = (newMasterKey: string) => {
    setMasterKey(newMasterKey);
    if (user) {
      userEncryptionService.saveMasterKey(user.id, newMasterKey);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        masterKey,
        isLoading,
        login,
        signup,
        logout,
        setUserMasterKey,
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

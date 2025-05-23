
import React, { createContext, useState, useContext, useEffect, ReactNode } from "react";
import { User } from "@/types";
import { authApi } from "@/services/api";
import { useToast } from "@/components/ui/use-toast";
import { decryptMasterKey } from "@/lib/cryptoUtils";

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  decryptedMasterKey: CryptoKey | null;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string, encryptedMasterKeyString: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [decryptedMasterKey, setDecryptedMasterKey] = useState<CryptoKey | null>(null);
  const { toast } = useToast();

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
      setUser(userData);
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
      const response = await authApi.login(email, password);
      setUser(response.user);
      setToken(response.token);
      localStorage.setItem("token", response.token);

      if (response.user.encryptedMasterKeyString) {
        try {
          const masterKeyBytes = await decryptMasterKey(response.user.encryptedMasterKeyString, password);
          const masterCryptoKey = await window.crypto.subtle.importKey(
            'raw',
            masterKeyBytes,
            { name: 'AES-GCM' },
            true,
            ['encrypt', 'decrypt']
          );
          setDecryptedMasterKey(masterCryptoKey);
          toast({
            title: "Secure session established.",
          });
        } catch (decryptionError) {
          console.error("Failed to decrypt master key:", decryptionError);
          setDecryptedMasterKey(null); 
          toast({
            title: "Session Warning",
            description: "Could not prepare your secure session. Some features might be unavailable or you may need to log in again.",
            variant: "destructive",
          });
        }
      } else {
        console.warn("User does not have an encryptedMasterKeyString. Skipping decryption.");
        setDecryptedMasterKey(null); // Ensure it's null if no key string
      }

      toast({
        title: "Login successful",
        description: `Welcome back, ${response.user.name}!`,
      });
    } catch (error) {
      console.error("Login failed:", error);
      setDecryptedMasterKey(null); // Also clear on general login failure
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

  const register = async (name: string, email: string, password: string, encryptedMasterKeyString: string) => {
    setLoading(true);
    try {
      const response = await authApi.register(name, email, password, encryptedMasterKeyString);
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
    setDecryptedMasterKey(null);
    localStorage.removeItem("token");
    toast({
      title: "Logged out",
      description: "You have been logged out successfully",
    });
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        decryptedMasterKey,
        login,
        register,
        logout,
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

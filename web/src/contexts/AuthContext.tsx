"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import api from "@/lib/api-client";

interface User {
  id: string;
  email: string;
  name: string;
  organizationUsers?: Array<{
    organization: {
      id: string;
      name: string;
      planTier: string;
      monthlyMatchLimit: number;
      matchesUsedThisPeriod: number;
    };
  }>;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    try {
      const token = localStorage.getItem("pinpoint_access_token");
      if (!token) {
        setUser(null);
        return;
      }
      const { data } = await api.get("/auth/me");
      setUser(data.data);
    } catch {
      setUser(null);
      localStorage.removeItem("pinpoint_access_token");
      localStorage.removeItem("pinpoint_refresh_token");
    }
  }, []);

  useEffect(() => {
    refreshUser().finally(() => setIsLoading(false));
  }, [refreshUser]);

  const login = async (email: string, password: string) => {
    const { data } = await api.post("/auth/login", { email, password });
    localStorage.setItem("pinpoint_access_token", data.data.accessToken);
    localStorage.setItem("pinpoint_refresh_token", data.data.refreshToken);
    setUser(data.data.user);
  };

  const signup = async (name: string, email: string, password: string) => {
    const { data } = await api.post("/auth/signup", { name, email, password });
    localStorage.setItem("pinpoint_access_token", data.data.accessToken);
    localStorage.setItem("pinpoint_refresh_token", data.data.refreshToken);
    setUser(data.data.user);
  };

  const logout = () => {
    localStorage.removeItem("pinpoint_access_token");
    localStorage.removeItem("pinpoint_refresh_token");
    setUser(null);
    window.location.href = "/login";
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        signup,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

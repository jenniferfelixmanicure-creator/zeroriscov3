import AsyncStorage from "@react-native-async-storage/async-storage";
import { setAuthTokenGetter, setBaseUrl } from "@workspace/api-client-react";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

const API_BASE = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;
setBaseUrl(API_BASE);

export type UserRole = "passenger" | "driver" | "admin";
export type ApprovalStatus = "pending" | "approved" | "rejected";

export interface AuthUser {
  id: number;
  name: string;
  cpf: string;
  phone: string;
  role: UserRole;
  avatarUrl?: string | null;
  approvalStatus?: ApprovalStatus;
}

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  refreshToken: string | null;
  isLoading: boolean;
  login: (token: string, refreshToken: string, user: AuthUser) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (user: AuthUser) => void;
  refreshSession: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  token: null,
  refreshToken: null,
  isLoading: true,
  login: async () => {},
  logout: async () => {},
  updateUser: () => {},
  refreshSession: async () => false,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const logout = useCallback(async () => {
    await Promise.all([
      AsyncStorage.removeItem("@zerorisco_token"),
      AsyncStorage.removeItem("@zerorisco_refresh_token"),
      AsyncStorage.removeItem("@zerorisco_user"),
    ]);
    setToken(null);
    setRefreshToken(null);
    setUser(null);
  }, []);

  const refreshSession = useCallback(async () => {
    const storedRefresh = await AsyncStorage.getItem("@zerorisco_refresh_token");
    if (!storedRefresh) return false;

    try {
      const res = await fetch(`${API_BASE}/api/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: storedRefresh }),
      });
      const data = await res.json();
      if (res.ok) {
        await Promise.all([
          AsyncStorage.setItem("@zerorisco_token", data.token),
          AsyncStorage.setItem("@zerorisco_refresh_token", data.refreshToken),
        ]);
        setToken(data.token);
        setRefreshToken(data.refreshToken);
        return true;
      } else {
        await logout();
        return false;
      }
    } catch {
      return false;
    }
  }, [logout]);

  useEffect(() => {
    setAuthTokenGetter(async () => {
      const t = await AsyncStorage.getItem("@zerorisco_token");
      // Aqui poderíamos checar se o token expirou e dar refresh automático
      return t;
    });

    const restore = async () => {
      try {
        const [storedToken, storedRefresh, storedUser] = await Promise.all([
          AsyncStorage.getItem("@zerorisco_token"),
          AsyncStorage.getItem("@zerorisco_refresh_token"),
          AsyncStorage.getItem("@zerorisco_user"),
        ]);
        if (storedToken && storedUser) {
          setToken(storedToken);
          setRefreshToken(storedRefresh);
          setUser(JSON.parse(storedUser));
        }
      } catch {
        // ignore
      } finally {
        setIsLoading(false);
      }
    };

    restore();
  }, []);

  const login = useCallback(async (newToken: string, newRefreshToken: string, newUser: AuthUser) => {
    await Promise.all([
      AsyncStorage.setItem("@zerorisco_token", newToken),
      AsyncStorage.setItem("@zerorisco_refresh_token", newRefreshToken),
      AsyncStorage.setItem("@zerorisco_user", JSON.stringify(newUser)),
    ]);
    setToken(newToken);
    setRefreshToken(newRefreshToken);
    setUser(newUser);
  }, []);

  const updateUser = useCallback((updated: AuthUser) => {
    setUser(updated);
    AsyncStorage.setItem("@zerorisco_user", JSON.stringify(updated));
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, refreshToken, isLoading, login, logout, updateUser, refreshSession }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

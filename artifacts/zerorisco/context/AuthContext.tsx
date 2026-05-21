import AsyncStorage from "@react-native-async-storage/async-storage";
import { setAuthTokenGetter, setBaseUrl } from "@workspace/api-client-react";
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

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
  subscriptionStatus?: string;
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

function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return typeof payload.exp === "number" && Date.now() / 1000 >= payload.exp - 60;
  } catch {
    return true;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const refreshingRef = useRef(false);

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

  const refreshSession = useCallback(async (): Promise<boolean> => {
    if (refreshingRef.current) return false;
    refreshingRef.current = true;

    try {
      const storedRefresh = await AsyncStorage.getItem("@zerorisco_refresh_token");
      if (!storedRefresh) {
        await logout();
        return false;
      }

      const res = await fetch(`${API_BASE}/api/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: storedRefresh }),
      });

      if (res.ok) {
        const data = await res.json();
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
    } finally {
      refreshingRef.current = false;
    }
  }, [logout]);

  useEffect(() => {
    setAuthTokenGetter(async () => {
      let t = await AsyncStorage.getItem("@zerorisco_token");
      if (t && isTokenExpired(t)) {
        const refreshed = await refreshSession();
        if (refreshed) {
          t = await AsyncStorage.getItem("@zerorisco_token");
        } else {
          return null;
        }
      }
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
          if (isTokenExpired(storedToken)) {
            const storedRefreshForRestore = storedRefresh;
            if (storedRefreshForRestore) {
              try {
                const res = await fetch(`${API_BASE}/api/auth/refresh`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ refreshToken: storedRefreshForRestore }),
                });
                if (res.ok) {
                  const data = await res.json();
                  await Promise.all([
                    AsyncStorage.setItem("@zerorisco_token", data.token),
                    AsyncStorage.setItem("@zerorisco_refresh_token", data.refreshToken),
                  ]);
                  setToken(data.token);
                  setRefreshToken(data.refreshToken);
                  setUser(JSON.parse(storedUser));
                } else {
                  await logout();
                }
              } catch {
                await logout();
              }
            } else {
              await logout();
            }
          } else {
            setToken(storedToken);
            setRefreshToken(storedRefresh);
            setUser(JSON.parse(storedUser));
          }
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

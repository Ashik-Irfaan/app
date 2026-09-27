import { useQueryClient } from "@tanstack/react-query";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { api, Role, TOKEN_KEY, User } from "@/src/api/client";
import { storage } from "@/src/utils/storage";

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (identifier: string, password: string, role: Role) => Promise<User>;
  register: (payload: Record<string, unknown>) => Promise<User>;
  logout: () => Promise<void>;
  setUser: (u: User) => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();

  useEffect(() => {
    (async () => {
      const token = await storage.secureGet<string | null>(TOKEN_KEY, null);
      if (token) {
        try {
          const me = await api<User>("/auth/me");
          setUser(me);
        } catch {
          await storage.secureRemove(TOKEN_KEY);
        }
      }
      setLoading(false);
    })();
  }, []);

  const login = useCallback(async (identifier: string, password: string, role: Role) => {
    const res = await api<{ access_token: string; user: User }>("/auth/login", {
      method: "POST",
      body: { identifier, password, role },
      auth: false,
    });
    await storage.secureSet(TOKEN_KEY, res.access_token);
    setUser(res.user);
    return res.user;
  }, []);

  const register = useCallback(async (payload: Record<string, unknown>) => {
    const res = await api<{ access_token: string; user: User }>("/auth/register", {
      method: "POST",
      body: payload,
      auth: false,
    });
    await storage.secureSet(TOKEN_KEY, res.access_token);
    setUser(res.user);
    return res.user;
  }, []);

  const logout = useCallback(async () => {
    await storage.secureRemove(TOKEN_KEY);
    queryClient.clear();
    setUser(null);
  }, [queryClient]);

  const value = useMemo(() => ({ user, loading, login, register, logout, setUser }), [user, loading, login, register, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

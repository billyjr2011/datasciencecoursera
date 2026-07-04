import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api, getToken, setToken } from "../api/client";
import type { PlanId, User } from "../types";

interface AuthCtx {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: { email: string; password: string; name?: string; plan?: PlanId }) => Promise<void>;
  logout: () => void;
  setPlan: (plan: PlanId) => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getToken()) {
      setLoading(false);
      return;
    }
    api.me()
      .then((r) => setUser(r.user))
      .catch(() => setToken(null))
      .finally(() => setLoading(false));
  }, []);

  async function login(email: string, password: string) {
    const r = await api.login({ email, password });
    setToken(r.token);
    setUser(r.user);
  }

  async function register(data: { email: string; password: string; name?: string; plan?: PlanId }) {
    const r = await api.register(data);
    setToken(r.token);
    setUser(r.user);
  }

  function logout() {
    setToken(null);
    setUser(null);
  }

  async function setPlan(plan: PlanId) {
    const r = await api.setPlan(plan);
    setUser(r.user);
  }

  return <Ctx.Provider value={{ user, loading, login, register, logout, setPlan }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used within AuthProvider");
  return v;
}

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

interface AuthState {
  loading: boolean;
  authenticated: boolean;
  email: string | null;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ loading: true, authenticated: false, email: null });

  useEffect(() => {
    fetch("/api/admin/auth/me", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) setState({ loading: false, authenticated: true, email: data.email });
        else setState({ loading: false, authenticated: false, email: null });
      })
      .catch(() => setState({ loading: false, authenticated: false, email: null }));
  }, []);

  const login = async (email: string, password: string) => {
    const res = await fetch("/api/admin/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Login failed");
    setState({ loading: false, authenticated: true, email: data.email });
  };

  const logout = async () => {
    await fetch("/api/admin/auth/logout", { method: "POST", credentials: "include" });
    setState({ loading: false, authenticated: false, email: null });
  };

  return <AuthContext.Provider value={{ ...state, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

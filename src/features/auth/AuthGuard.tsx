import React, { createContext, useContext, useState, useCallback } from "react";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface AuthContextValue {
  user: AuthUser;
  token: string;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, pass: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
}

const DEFAULT_ADMIN_USER: AuthUser = {
  id: "usr_sandeep_admin",
  name: "Sandeep Gautam",
  email: "bagosandeep@gmail.com",
  role: "admin"
};

const DEFAULT_ADMIN_TOKEN = "sess_sandeep_open_access_2026";

const AuthContext = createContext<AuthContextValue>({
  user: DEFAULT_ADMIN_USER,
  token: DEFAULT_ADMIN_TOKEN,
  isAuthenticated: true,
  isLoading: false,
  login: async () => ({ success: true }),
  logout: async () => {}
});

/**
 * Open Access AuthProvider:
 * Bypasses password/login screens completely as requested by Sandeep.
 * Direct access to the full Opportunity OS dashboard with administrator privileges.
 */
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user] = useState<AuthUser>(DEFAULT_ADMIN_USER);
  const [token] = useState<string>(DEFAULT_ADMIN_TOKEN);

  const login = useCallback(async (_email: string, pass: string) => {
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pass })
      });
      if (!res.ok) {
        return { success: false, error: "Invalid credentials" };
      }
      const data = (await res.json()) as { token?: string };
      if (data.token && typeof window !== "undefined") {
        window.localStorage.setItem("sandeep_auth_token", data.token);
      }
      return { success: true };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : "Authentication error" };
    }
  }, []);

  const logout = useCallback(async () => {
    // Open access mode: keep session active
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: true,
        isLoading: false,
        login,
        logout
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextValue => {
  return useContext(AuthContext);
};

/**
 * Open Access AuthGuard:
 * Renders application children directly without requiring any login screen or password prompt.
 */
export const AuthGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <>{children}</>;
};

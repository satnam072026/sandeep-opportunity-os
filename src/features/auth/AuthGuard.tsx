import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

export interface AuthUser { id: string; name: string; email: string; role: string; }
interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null, isAuthenticated: false, isLoading: true,
  login: async () => ({ success: false }), logout: async () => {}
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetch("/api/auth/session", { credentials: "include" })
      .then(async (response) => response.ok ? response.json() as Promise<{ user: AuthUser }> : null)
      .then((data) => { if (active) setUser(data?.user ?? null); })
      .catch(() => { if (active) setUser(null); })
      .finally(() => { if (active) setIsLoading(false); });
    return () => { active = false; };
  }, []);

  const login = useCallback(async (_email: string, password: string) => {
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password })
      });
      if (!response.ok) return { success: false, error: "Invalid password" };
      const data = (await response.json()) as { user: AuthUser };
      setUser(data.user);
      return { success: true };
    } catch {
      return { success: false, error: "Unable to reach the secure login service" };
    }
  }, []);

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" }).catch(() => undefined);
    setUser(null);
  }, []);

  return <AuthContext.Provider value={{ user, isAuthenticated: Boolean(user), isLoading, login, logout }}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextValue => useContext(AuthContext);

export const AuthGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading, login } = useAuth();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (isLoading) return <div className="auth-loading">Securing your workspace…</div>;
  if (isAuthenticated) return <>{children}</>;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setSubmitting(true); setError("");
    const result = await login("", password);
    if (!result.success) setError(result.error || "Sign-in failed");
    setSubmitting(false);
  };

  return (
    <main className="auth-shell">
      <section className="auth-card" aria-labelledby="auth-title">
        <div className="auth-mark" aria-hidden="true">OS</div>
        <p className="auth-eyebrow">SANDEEP OPPORTUNITY OS</p>
        <h1 id="auth-title">Private intelligence workspace</h1>
        <p className="auth-copy">Sign in to access your opportunities, agent activity, and CRM records.</p>
        <form onSubmit={submit} className="auth-form">
          <label htmlFor="admin-password">Administrator password</label>
          <input id="admin-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required autoFocus />
          {error ? <p className="auth-error" role="alert">{error}</p> : null}
          <button type="submit" disabled={submitting}>{submitting ? "Signing in…" : "Enter workspace"}</button>
        </form>
        <p className="auth-security">Protected with an encrypted, HTTP-only session.</p>
      </section>
    </main>
  );
};

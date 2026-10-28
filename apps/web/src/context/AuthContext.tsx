import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ApiError, authedRequest, clearSession, loadSession, postJson, saveSession, type Session, type SessionUser } from "../lib/api";

interface AuthContextValue {
  session: Session | null;
  ready: boolean;
  login: (email: string, password: string, deviceId: string) => Promise<SessionUser>;
  logout: () => Promise<void>;
  request: <T>(method: string, path: string, body?: unknown) => Promise<T>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: SessionUser;
}

interface RefreshResponse {
  accessToken: string;
  refreshToken: string;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(() => loadSession());
  const [ready, setReady] = useState(false);
  const refreshing = useRef(false);

  useEffect(() => {
    setReady(true);
  }, []);

  const persistTokens = useCallback((accessToken: string, refreshToken: string) => {
    setSession((current) => {
      if (!current) return current;
      const next: Session = { ...current, accessToken, refreshToken };
      saveSession(next);
      return next;
    });
  }, []);

  const request = useCallback(
    async <T,>(method: string, path: string, body?: unknown): Promise<T> => {
      const retryAuth = async (): Promise<boolean> => {
        const current = loadSession();
        if (!current || refreshing.current) return false;
        refreshing.current = true;
        try {
          const data = await postJson<RefreshResponse>("/auth/refresh", { refreshToken: current.refreshToken });
          persistTokens(data.accessToken, data.refreshToken);
          return true;
        } catch {
          return false;
        } finally {
          refreshing.current = false;
        }
      };

      return authedRequest<T>(method, path, body, retryAuth).catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          clearSession();
          setSession(null);
        }
        throw err;
      });
    },
    [persistTokens],
  );

  const login = useCallback(async (email: string, password: string, deviceId: string) => {
    const data = await postJson<LoginResponse>("/auth/login", { email, password, deviceId });
    const next: Session = {
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      user: data.user,
      deviceId,
    };
    saveSession(next);
    setSession(next);
    return next.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await postJson("/auth/logout", { refreshToken: session?.refreshToken });
    } catch {
      // revoked/expired token tetap keluar
    }
    clearSession();
    setSession(null);
  }, [session]);

  const value = useMemo(() => ({ session, ready, login, logout, request }) satisfies AuthContextValue, [session, ready, login, logout, request]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

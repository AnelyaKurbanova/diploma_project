'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  API_BASE_URL,
  apiGet,
  apiPost,
  setRefreshAccessTokenHandler,
} from "./api";

type User = {
  id: string;
  email: string;
  role: string;
  is_email_verified: boolean;
  is_active: boolean;
};

type AuthContextValue = {
  user: User | null;
  accessToken: string | null;
  isLoading: boolean;
  error: string | null;
  reloadUser: () => Promise<void>;
  loginWithGoogle: () => void;
  logout: () => Promise<void>;
  refreshToken: () => Promise<string | null>;
  setFromCallback: (accessToken: string) => Promise<void>;
  // Email-based auth flow
  startEmailLogin: (email: string) => Promise<void>;
  verifyEmailLogin: (email: string, code: string) => Promise<void>;
  startEmailRegister: (email: string) => Promise<void>;
  verifyEmailRegister: (email: string, code: string) => Promise<void>;
  pendingEmail: string | null;
  pendingPurpose: "login" | "register" | null;
  emailFlowError: string | null;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const ACCESS_TOKEN_STORAGE_KEY = "access_token";

function getCsrfTokenFromCookies(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith("csrf_token="));
  if (!match) return null;
  return decodeURIComponent(match.split("=")[1] ?? "");
}

async function postAuthWithCsrf<T>(path: string): Promise<T> {
  const csrf = getCsrfTokenFromCookies();
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(csrf && { "X-CSRF-Token": csrf }),
  };
  return apiPost<T>(path, undefined, undefined, {
    credentials: "include",
    headers,
  });
}

type AuthProviderProps = {
  children: React.ReactNode;
};

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [pendingPurpose, setPendingPurpose] = useState<"login" | "register" | null>(null);
  const [emailFlowError, setEmailFlowError] = useState<string | null>(null);

  const persistAccessToken = useCallback((token: string | null) => {
    if (typeof window === "undefined") return;
    if (token) {
      window.localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, token);
    } else {
      window.localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
    }
  }, []);

  const loadUser = useCallback(
    async (token: string) => {
      const me = await apiGet<User>("/auth/me", token);
      setUser(me);
    },
    [],
  );

  const refreshToken = useCallback(async (): Promise<string | null> => {
    if (isRefreshing) return accessToken ?? null;
    setIsRefreshing(true);
    try {
      const data = await postAuthWithCsrf<{ access_token: string }>(
        "/auth/refresh",
      );
      setAccessToken(data.access_token);
      persistAccessToken(data.access_token);
      await loadUser(data.access_token);
      setError(null);
      return data.access_token;
    } catch (err) {
      console.error("Failed to refresh token", err);
      setAccessToken(null);
      persistAccessToken(null);
      setUser(null);
      return null;
    } finally {
      setIsRefreshing(false);
    }
  }, [accessToken, isRefreshing, loadUser, persistAccessToken]);

  useEffect(() => {
    setRefreshAccessTokenHandler(async () => {
      return refreshToken();
    });
  }, [refreshToken]);

  useEffect(() => {
    // Initial hydration from localStorage
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY);
    if (!stored) {
      setIsLoading(false);
      return;
    }

    (async () => {
      try {
        setAccessToken(stored);
        await loadUser(stored);
        setError(null);
      } catch (err) {
        console.warn("Stored access token is invalid, clearing", err);
        setAccessToken(null);
        persistAccessToken(null);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [loadUser, persistAccessToken]);

  const loginWithGoogle = useCallback(() => {
    if (typeof window === "undefined") return;
    window.location.href = `${API_BASE_URL}/auth/google/login`;
  }, []);

  const reloadUser = useCallback(async () => {
    if (!accessToken) return;
    await loadUser(accessToken);
  }, [accessToken, loadUser]);

  const startEmailLogin = useCallback(
    async (email: string) => {
      try {
        setEmailFlowError(null);
        await apiPost<void>("/auth/login/email/start", { email });
        setPendingEmail(email);
        setPendingPurpose("login");
      } catch (err) {
        console.error("Failed to start email login", err);
        const message =
          err instanceof Error
            ? err.message
            : "Не удалось отправить код для входа. Попробуйте ещё раз.";
        setEmailFlowError(message);
        throw err;
      }
    },
    [],
  );

  const startEmailRegister = useCallback(
    async (email: string) => {
      try {
        setEmailFlowError(null);
        await apiPost<void>("/auth/register/start", { email });
        setPendingEmail(email);
        setPendingPurpose("register");
      } catch (err) {
        console.error("Failed to start email register", err);
        const message =
          err instanceof Error
            ? err.message
            : "Не удалось отправить код для регистрации. Попробуйте ещё раз.";
        setEmailFlowError(message);
        throw err;
      }
    },
    [],
  );

  const verifyEmailLogin = useCallback(
    async (email: string, code: string) => {
      setIsLoading(true);
      try {
        setEmailFlowError(null);
        const data = await apiPost<{ access_token: string }>(
          "/auth/login/email/verify",
          { email, code },
        );
        setAccessToken(data.access_token);
        persistAccessToken(data.access_token);
        await loadUser(data.access_token);
        setError(null);
        setPendingEmail(null);
        setPendingPurpose(null);
      } catch (err) {
        console.error("Failed to verify email login code", err);
        const message =
          err instanceof Error
            ? err.message
            : "Не удалось подтвердить код входа. Попробуйте ещё раз.";
        setEmailFlowError(message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [loadUser, persistAccessToken],
  );

  const verifyEmailRegister = useCallback(
    async (email: string, code: string) => {
      setIsLoading(true);
      try {
        setEmailFlowError(null);
        const data = await apiPost<{ access_token: string }>(
          "/auth/register/verify",
          { email, code },
        );
        setAccessToken(data.access_token);
        persistAccessToken(data.access_token);
        await loadUser(data.access_token);
        setError(null);
        setPendingEmail(null);
        setPendingPurpose(null);
      } catch (err) {
        console.error("Failed to verify email register code", err);
        const message =
          err instanceof Error
            ? err.message
            : "Не удалось подтвердить код регистрации. Попробуйте ещё раз.";
        setEmailFlowError(message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [loadUser, persistAccessToken],
  );

  const setFromCallback = useCallback(
    async (token: string) => {
      setIsLoading(true);
      try {
        setAccessToken(token);
        persistAccessToken(token);
        await loadUser(token);
        setError(null);
      } catch (err) {
        console.error("Failed to finalize login from callback", err);
        setAccessToken(null);
        persistAccessToken(null);
        setUser(null);
        setError("Не удалось завершить авторизацию. Попробуйте ещё раз.");
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [loadUser, persistAccessToken],
  );

  const logout = useCallback(async () => {
    try {
      await postAuthWithCsrf<{ message: string }>("/auth/logout");
    } catch (err) {
      console.error("Failed to call /auth/logout", err);
    } finally {
      setAccessToken(null);
      persistAccessToken(null);
      setUser(null);
      setError(null);
    }
  }, [persistAccessToken]);

  const value: AuthContextValue = useMemo(
    () => ({
      user,
      accessToken,
      isLoading,
      error,
      reloadUser,
      loginWithGoogle,
      logout,
      refreshToken,
      setFromCallback,
      startEmailLogin,
      verifyEmailLogin,
      startEmailRegister,
      verifyEmailRegister,
      pendingEmail,
      pendingPurpose,
      emailFlowError,
    }),
    [
      user,
      accessToken,
      isLoading,
      error,
      reloadUser,
      loginWithGoogle,
      logout,
      refreshToken,
      setFromCallback,
      startEmailLogin,
      verifyEmailLogin,
      startEmailRegister,
      verifyEmailRegister,
      pendingEmail,
      pendingPurpose,
      emailFlowError,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}

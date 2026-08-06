"use client";

import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { api } from "@/lib/api";
import { disconnectSocket } from "@/lib/socket";
import type { CurrentUser } from "@/lib/types";
import { useMe } from "@/hooks/useMe";
import { useToast } from "@/components/ui/Toast";

interface AuthContextValue {
  me: CurrentUser | undefined;
  isLoading: boolean;
  isLoggedIn: boolean;
  busy: boolean;
  loginWithPassword: (email: string, password: string) => Promise<boolean>;
  loginWithOtp: (email: string, otp: string) => Promise<boolean>;
  signup: (input: {
    username: string;
    email: string;
    password: string;
    full_name?: string;
  }) => Promise<boolean>;
  logout: () => Promise<void>;
  refresh: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Where to land after signing in.
 *
 * Read straight off `window.location` rather than via `useSearchParams` — this
 * provider sits in the root layout, and that hook would opt every page out of
 * static rendering. Only same-site paths are honoured, so `?next=` can't be
 * turned into an open redirect.
 */
function redirectTarget(fallback: string): string {
  if (typeof window === "undefined") return fallback;

  const value = new URLSearchParams(window.location.search).get("next");
  if (!value) return fallback;

  const decoded = decodeURIComponent(value);
  return decoded.startsWith("/") && !decoded.startsWith("//") ? decoded : fallback;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const toast = useToast();
  const { me, isLoading, refresh } = useMe();
  const [busy, setBusy] = useState(false);

  /**
   * The session is set by the server as an httpOnly cookie, so signing in is
   * just "make the call, then re-read /users/me" — the client never handles a
   * token directly.
   */
  const run = useCallback(
    async (request: () => Promise<unknown>, fallback = "/dashboard/feed") => {
      setBusy(true);
      try {
        await request();
        await refresh();
        // Return them to whatever they were trying to reach, if anything.
        router.replace(redirectTarget(fallback));
        return true;
      } catch (error) {
        toast.error((error as Error).message);
        return false;
      } finally {
        setBusy(false);
      }
    },
    [refresh, router, toast]
  );

  const loginWithPassword = useCallback(
    (email: string, password: string) =>
      run(() => api.post("/auth/login", { email, password })),
    [run]
  );

  const loginWithOtp = useCallback(
    (email: string, otp: string) => run(() => api.post("/auth/login-otp", { email, otp })),
    [run]
  );

  const signup = useCallback(
    (input: { username: string; email: string; password: string; full_name?: string }) =>
      run(() => api.post("/auth/signup", input), "/dashboard/profile"),
    [run]
  );

  const logout = useCallback(async () => {
    setBusy(true);
    try {
      await api.post("/auth/logout");
    } catch {
      // Even if the call fails, drop the local session so the user isn't stuck.
    } finally {
      disconnectSocket();
      await refresh(undefined, { revalidate: false });
      setBusy(false);
      router.replace("/auth/login");
    }
  }, [refresh, router]);

  const value = useMemo<AuthContextValue>(
    () => ({
      me,
      isLoading,
      isLoggedIn: Boolean(me),
      busy,
      loginWithPassword,
      loginWithOtp,
      signup,
      logout,
      refresh,
    }),
    [me, isLoading, busy, loginWithPassword, loginWithOtp, signup, logout, refresh]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside an AuthProvider");
  return context;
}

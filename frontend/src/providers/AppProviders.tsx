"use client";

import type { ReactNode } from "react";
import { SWRConfig } from "swr";
import { swrFetcher } from "@/lib/api";
import { ToastProvider } from "@/components/ui/Toast";
import { AuthProvider } from "./AuthProvider";

/**
 * Client providers shared by every route.
 *
 * Everything below the ToastProvider can raise toasts, and AuthProvider needs
 * one, so the ordering here matters.
 */
export default function AppProviders({ children }: { children: ReactNode }) {
  return (
    <SWRConfig
      value={{
        fetcher: swrFetcher,
        revalidateOnFocus: false,
        // A short dedupe window collapses the duplicate requests that fire when
        // several components mount at once on a route change.
        dedupingInterval: 3000,
        errorRetryCount: 2,
      }}
    >
      <ToastProvider>
        <AuthProvider>{children}</AuthProvider>
      </ToastProvider>
    </SWRConfig>
  );
}

"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";
import { useMounted } from "@/hooks/useMounted";
import { CheckIcon, XIcon } from "./icons";

type ToastTone = "success" | "error" | "info";

interface ToastItem {
  id: number;
  tone: ToastTone;
  message: string;
}

interface ToastApi {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const TONE_STYLES: Record<ToastTone, string> = {
  success: "bg-emerald-600 text-white",
  error: "bg-danger text-white",
  info: "bg-brand text-white",
};

const DURATION_MS = 4000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(0);
  const mounted = useMounted();

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback(
    (tone: ToastTone, message: string) => {
      if (!message) return;
      const id = nextId.current++;
      setToasts((current) => [...current.slice(-2), { id, tone, message }]);
      setTimeout(() => dismiss(id), DURATION_MS);
    },
    [dismiss]
  );

  const api = useMemo<ToastApi>(
    () => ({
      success: (message: string) => push("success", message),
      error: (message: string) => push("error", message),
      info: (message: string) => push("info", message),
    }),
    [push]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}

      {mounted &&
        createPortal(
          <div
            // Fixed overlay so toasts never take part in document flow.
            className="pointer-events-none fixed inset-x-0 top-3 z-[100] flex flex-col items-center gap-2 px-3 tab:top-auto tab:bottom-5 tab:right-5 tab:left-auto tab:items-end"
            role="region"
            aria-label="Notifications"
          >
            {toasts.map((toast) => (
              <div
                key={toast.id}
                role="status"
                aria-live="polite"
                className={cn(
                  "pointer-events-auto flex w-full max-w-sm items-start gap-2.5 rounded-xl px-4 py-3",
                  "text-sm font-medium shadow-lg animate-scale-in",
                  TONE_STYLES[toast.tone]
                )}
              >
                {toast.tone === "success" && (
                  <CheckIcon className="mt-0.5 h-4 w-4 shrink-0" />
                )}
                <span className="min-w-0 flex-1 break-words">{toast.message}</span>
                <button
                  type="button"
                  onClick={() => dismiss(toast.id)}
                  aria-label="Dismiss"
                  className="-mr-1 shrink-0 rounded p-0.5 opacity-80 hover:opacity-100"
                >
                  <XIcon className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>,
          document.body
        )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside a ToastProvider");
  return context;
}

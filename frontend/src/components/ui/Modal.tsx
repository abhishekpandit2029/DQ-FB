"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";
import { useLockBodyScroll } from "@/hooks/useLockBodyScroll";
import { useMounted } from "@/hooks/useMounted";
import IconButton from "./IconButton";
import { XIcon } from "./icons";

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  /** Set false for destructive flows that must be dismissed deliberately. */
  closeOnBackdrop?: boolean;
  className?: string;
}

const SIZES = {
  sm: "tab:max-w-sm",
  md: "tab:max-w-lg",
  lg: "tab:max-w-2xl",
  xl: "tab:max-w-4xl",
};

export default function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  closeOnBackdrop = true,
  className,
}: ModalProps) {
  const mounted = useMounted();
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useLockBodyScroll(open);

  useEffect(() => {
    if (!open) return;

    previouslyFocused.current = document.activeElement as HTMLElement;
    // Focus the panel so screen readers and keyboard users land inside it.
    panelRef.current?.focus();

    return () => previouslyFocused.current?.focus?.();
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }

      if (event.key !== "Tab" || !panelRef.current) return;

      // Keep Tab cycling inside the dialog while it's open.
      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea, input:not([disabled]), select, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!mounted || !open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center tab:items-center"
      role="presentation"
    >
      <div
        // Indigo-tinted scrim rather than flat black, so overlays sit in the
        // same colour family as the rest of the UI.
        className="absolute inset-0 bg-[#1e1b4b]/40 backdrop-blur-[2px] animate-fade-in"
        onClick={closeOnBackdrop ? onClose : undefined}
        aria-hidden="true"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        className={cn(
          "relative flex max-h-[92dvh] w-full flex-col bg-surface shadow-xl outline-none",
          // Sheet on phones, centred dialog from tablet up.
          "rounded-t-2xl animate-slide-up",
          "tab:rounded-2xl tab:animate-scale-in",
          SIZES[size],
          className
        )}
      >
        {(title || description) && (
          <header className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
            <div className="min-w-0">
              {title && (
                <h2 className="truncate text-base font-semibold text-content">{title}</h2>
              )}
              {description && (
                <p className="mt-0.5 text-sm text-muted">{description}</p>
              )}
            </div>
            <IconButton label="Close" onClick={onClose} className="-mr-1 -mt-1 shrink-0">
              <XIcon />
            </IconButton>
          </header>
        )}

        <div
          className={cn(
            "min-h-0 flex-1 overflow-y-auto px-5 py-4",
            // Without a footer the body is the panel's last row, so it owns the
            // job of clearing the home indicator on phones.
            !footer && "pb-safe [--dq-safe-pb:1rem]"
          )}
        >
          {children}
        </div>

        {footer && (
          <footer className="flex flex-col-reverse gap-2 border-t border-line px-5 py-4 pb-safe [--dq-safe-pb:1rem] tab:flex-row tab:justify-end">
            {footer}
          </footer>
        )}
      </div>
    </div>,
    document.body
  );
}

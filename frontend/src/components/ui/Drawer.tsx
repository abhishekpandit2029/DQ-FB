"use client";

import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";
import { useLockBodyScroll } from "@/hooks/useLockBodyScroll";
import { useMounted } from "@/hooks/useMounted";
import IconButton from "./IconButton";
import { XIcon } from "./icons";

export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  side?: "left" | "right" | "bottom";
  className?: string;
}

const PANEL_POSITION = {
  left: "inset-y-0 left-0 h-full w-[85vw] max-w-sm animate-slide-in-right",
  right: "inset-y-0 right-0 h-full w-[85vw] max-w-sm animate-slide-in-right",
  bottom: "inset-x-0 bottom-0 max-h-[85dvh] w-full rounded-t-2xl animate-slide-up",
};

export default function Drawer({
  open,
  onClose,
  title,
  children,
  footer,
  side = "right",
  className,
}: DrawerProps) {
  const mounted = useMounted();
  useLockBodyScroll(open);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!mounted || !open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50" role="presentation">
      <div
        className="absolute inset-0 bg-[#1e1b4b]/40 backdrop-blur-[2px] animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      <aside
        role="dialog"
        aria-modal="true"
        className={cn(
          "absolute flex flex-col bg-surface shadow-xl",
          PANEL_POSITION[side],
          className
        )}
      >
        {title && (
          <header className="flex items-center justify-between gap-4 border-b border-line px-5 py-4">
            <h2 className="truncate text-base font-semibold text-content">{title}</h2>
            <IconButton label="Close" onClick={onClose} className="-mr-1">
              <XIcon />
            </IconButton>
          </header>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>

        {footer && (
          <footer className="border-t border-line px-5 py-4 pb-safe [--dq-safe-pb:1rem]">
            {footer}
          </footer>
        )}
      </aside>
    </div>,
    document.body
  );
}

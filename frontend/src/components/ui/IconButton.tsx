"use client";

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Accessible name — icon-only buttons have no text content of their own. */
  label: string;
  children: ReactNode;
  variant?: "ghost" | "solid" | "danger";
  size?: "sm" | "md";
}

const VARIANTS = {
  ghost: "text-muted hover:bg-surface-muted hover:text-content",
  solid: "bg-brand text-white hover:bg-brand-strong",
  danger: "bg-danger text-white hover:opacity-90",
};

const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, children, variant = "ghost", size = "md", className, type = "button", ...props },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full",
        "transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50",
        size === "sm" ? "h-8 w-8" : "h-10 w-10",
        VARIANTS[variant],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
});

export default IconButton;

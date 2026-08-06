"use client";

import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
  leftIcon?: ReactNode;
  rightSlot?: ReactNode;
}

const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, leftIcon, rightSlot, className, id, ...props },
  ref
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const describedBy = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined;

  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={inputId}
          className="mb-1.5 block text-sm font-medium text-content"
        >
          {label}
        </label>
      )}

      <div className="relative">
        {leftIcon && (
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted">
            {leftIcon}
          </span>
        )}

        <input
          ref={ref}
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(
            "w-full rounded-lg bg-surface text-content placeholder:text-muted",
            "ring-1 ring-inset ring-line focus:ring-2 focus:ring-brand focus:outline-none",
            "transition-shadow duration-150",
            // 16px on mobile stops iOS Safari zooming in on focus.
            "h-11 text-base tab:text-sm",
            leftIcon ? "pl-10" : "pl-3",
            rightSlot ? "pr-11" : "pr-3",
            error && "ring-danger focus:ring-danger",
            "disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-muted",
            className
          )}
          {...props}
        />

        {rightSlot && (
          <span className="absolute inset-y-0 right-1 flex items-center">{rightSlot}</span>
        )}
      </div>

      {/* Reserved line height keeps the field from shifting when an error appears. */}
      {(hint || error) && (
        <p
          id={describedBy}
          className={cn("mt-1.5 min-h-[1.25rem] text-xs", error ? "text-danger" : "text-muted")}
        >
          {error || hint}
        </p>
      )}
    </div>
  );
});

export default Input;

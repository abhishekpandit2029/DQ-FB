"use client";

import { forwardRef, useId, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
  error?: string;
  /** Shows a `used / maxLength` counter under the field. */
  showCount?: boolean;
}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, hint, error, showCount, className, id, maxLength, value, ...props },
  ref
) {
  const generatedId = useId();
  const textareaId = id ?? generatedId;
  const length = typeof value === "string" ? value.length : 0;

  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={textareaId}
          className="mb-1.5 block text-sm font-medium text-content"
        >
          {label}
        </label>
      )}

      <textarea
        ref={ref}
        id={textareaId}
        maxLength={maxLength}
        value={value}
        aria-invalid={error ? true : undefined}
        className={cn(
          "w-full rounded-lg bg-surface px-3 py-2.5 text-content placeholder:text-muted",
          "ring-1 ring-inset ring-line focus:ring-2 focus:ring-brand focus:outline-none",
          "text-base tab:text-sm resize-y min-h-[7rem]",
          error && "ring-danger focus:ring-danger",
          className
        )}
        {...props}
      />

      <div className="mt-1.5 flex min-h-[1.25rem] items-start justify-between gap-3 text-xs">
        <span className={cn(error ? "text-danger" : "text-muted")}>{error || hint}</span>
        {showCount && maxLength ? (
          <span className="shrink-0 tabular-nums text-muted">
            {length}/{maxLength}
          </span>
        ) : null}
      </div>
    </div>
  );
});

export default Textarea;

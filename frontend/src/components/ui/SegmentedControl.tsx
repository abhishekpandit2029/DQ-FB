"use client";

import { cn } from "@/lib/cn";

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

export interface SegmentedControlProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: SegmentedOption<T>[];
  size?: "sm" | "md";
  fullWidth?: boolean;
  className?: string;
  "aria-label"?: string;
}

/** Two-or-three-way choice; also used for the "everyone / followers" settings. */
export default function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  size = "md",
  fullWidth = true,
  className,
  ...props
}: SegmentedControlProps<T>) {
  return (
    <div
      role="tablist"
      aria-label={props["aria-label"]}
      className={cn(
        "inline-flex rounded-lg bg-surface-muted p-1 ring-1 ring-inset ring-line",
        fullWidth && "w-full",
        className
      )}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              "flex-1 whitespace-nowrap rounded-md font-medium transition-colors duration-150",
              size === "sm" ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm",
              selected
                ? "bg-surface text-content shadow-sm"
                : "text-muted hover:text-content"
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

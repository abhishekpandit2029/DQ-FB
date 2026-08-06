"use client";

import { cn } from "@/lib/cn";

export interface TabItem<T extends string> {
  value: T;
  label: string;
  count?: number;
}

export interface TabsProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  items: TabItem<T>[];
  className?: string;
}

/** Underlined tab bar; scrolls horizontally when the labels overflow. */
export default function Tabs<T extends string>({
  value,
  onChange,
  items,
  className,
}: TabsProps<T>) {
  return (
    <div
      role="tablist"
      className={cn(
        "flex gap-1 overflow-x-auto border-b border-line scrollbar-hide",
        className
      )}
    >
      {items.map((item) => {
        const selected = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(item.value)}
            className={cn(
              "relative whitespace-nowrap px-4 py-3 text-sm font-medium transition-colors",
              selected ? "text-brand" : "text-muted hover:text-content"
            )}
          >
            <span className="flex items-center gap-1.5">
              {item.label}
              {item.count !== undefined && item.count > 0 && (
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-[0.6875rem] font-semibold tabular-nums",
                    selected ? "bg-brand text-white" : "bg-surface-muted text-muted"
                  )}
                >
                  {item.count}
                </span>
              )}
            </span>

            {/* Indicator is absolutely positioned so switching tabs can't shift
                the row's height. */}
            <span
              className={cn(
                "absolute inset-x-2 bottom-0 h-0.5 rounded-full transition-opacity",
                selected ? "bg-brand opacity-100" : "opacity-0"
              )}
            />
          </button>
        );
      })}
    </div>
  );
}

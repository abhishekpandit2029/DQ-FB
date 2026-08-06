import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type Tone = "neutral" | "brand" | "success" | "warning" | "danger";

const TONES: Record<Tone, string> = {
  neutral: "bg-surface-muted text-muted ring-line",
  brand: "bg-brand/10 text-brand ring-brand/20",
  success: "bg-emerald-500/10 text-emerald-600 ring-emerald-500/20",
  warning: "bg-amber-500/10 text-amber-600 ring-amber-500/20",
  danger: "bg-danger/10 text-danger ring-danger/20",
};

export interface TagProps {
  children: ReactNode;
  tone?: Tone;
  icon?: ReactNode;
  className?: string;
}

export default function Tag({ children, tone = "neutral", icon, className }: TagProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5",
        "text-xs font-medium ring-1 ring-inset",
        TONES[tone],
        className
      )}
    >
      {icon}
      {children}
    </span>
  );
}

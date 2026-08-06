"use client";

import Image from "next/image";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { initialsOf } from "@/lib/format";

type Size = "xs" | "sm" | "md" | "lg" | "xl";

const SIZES: Record<Size, { box: string; px: number; text: string }> = {
  xs: { box: "h-7 w-7", px: 28, text: "text-[0.625rem]" },
  sm: { box: "h-9 w-9", px: 36, text: "text-xs" },
  md: { box: "h-11 w-11", px: 44, text: "text-sm" },
  lg: { box: "h-16 w-16", px: 64, text: "text-lg" },
  xl: { box: "h-24 w-24 tab:h-28 tab:w-28", px: 112, text: "text-2xl" },
};

export interface AvatarProps {
  src?: string | null;
  name?: string;
  username?: string;
  size?: Size;
  online?: boolean;
  className?: string;
  priority?: boolean;
}

/**
 * Fixed-size avatar with an initials fallback.
 *
 * The box is sized by CSS before the image loads, so a slow photo never
 * reflows the row it sits in.
 */
export default function Avatar({
  src,
  name = "",
  username = "",
  size = "md",
  online,
  className,
  priority = false,
}: AvatarProps) {
  const [failed, setFailed] = useState(false);
  const { box, px, text } = SIZES[size];
  const showImage = Boolean(src) && !failed;

  return (
    <span className={cn("relative inline-flex shrink-0", box, className)}>
      {showImage ? (
        <Image
          src={src as string}
          alt={name || username || "Profile photo"}
          width={px}
          height={px}
          priority={priority}
          onError={() => setFailed(true)}
          className="h-full w-full rounded-full object-cover ring-1 ring-line"
        />
      ) : (
        <span
          aria-hidden="true"
          className={cn(
            "flex h-full w-full items-center justify-center rounded-full",
            "bg-brand/10 font-semibold text-brand ring-1 ring-line",
            text
          )}
        >
          {initialsOf(name, username)}
        </span>
      )}

      {online !== undefined && (
        <span
          className={cn(
            "absolute bottom-0 right-0 block rounded-full ring-2 ring-surface",
            size === "xs" || size === "sm" ? "h-2.5 w-2.5" : "h-3 w-3",
            online ? "bg-emerald-500" : "bg-[rgb(var(--dq-border))]"
          )}
          aria-label={online ? "Online" : "Offline"}
        />
      )}
    </span>
  );
}

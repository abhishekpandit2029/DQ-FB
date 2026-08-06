import Image from "next/image";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import noData from "@/stuff/Nodata.svg";

export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  /**
   * Shows the full "no data" illustration instead of the small icon badge.
   * Worth it on a whole empty page; too heavy inside a modal or a sidebar.
   */
  illustrated?: boolean;
  className?: string;
}

export default function EmptyState({
  icon,
  title,
  description,
  action,
  illustrated = false,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center px-6 py-14 text-center",
        className
      )}
    >
      {illustrated ? (
        <Image
          src={noData}
          alt=""
          aria-hidden="true"
          className="mb-6 h-auto w-full max-w-[15rem] opacity-90"
        />
      ) : (
        icon && (
          <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-surface-muted text-2xl text-muted">
            {icon}
          </span>
        )
      )}

      <h3 className="text-base font-semibold text-content">{title}</h3>
      {description && (
        <p className="mt-1.5 max-w-sm text-sm text-muted text-balance">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

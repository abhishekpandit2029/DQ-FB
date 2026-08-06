import { cn } from "@/lib/cn";

export interface SkeletonProps {
  className?: string;
  rounded?: "sm" | "md" | "lg" | "full";
}

const RADIUS = {
  sm: "rounded",
  md: "rounded-lg",
  lg: "rounded-xl",
  full: "rounded-full",
};

/**
 * Placeholder block. Every skeleton should match the footprint of what it
 * replaces — that's what keeps content swapping in without a layout shift.
 */
export default function Skeleton({ className, rounded = "md" }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={cn("dq-skeleton", RADIUS[rounded], className)}
    />
  );
}

/** Matches the footprint of one PostCard. */
export function PostCardSkeleton() {
  return (
    <article className="rounded-xl bg-surface p-4 ring-1 ring-line tab:p-5">
      <div className="flex items-center gap-3">
        <Skeleton className="h-11 w-11" rounded="full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3.5 w-32" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>
      <div className="mt-4 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-2/3" />
      </div>
      <div className="mt-4 flex gap-4 border-t border-line pt-3">
        <Skeleton className="h-7 w-16" rounded="full" />
        <Skeleton className="h-7 w-16" rounded="full" />
        <Skeleton className="h-7 w-16" rounded="full" />
      </div>
    </article>
  );
}

/** Matches the footprint of one UserRow. */
export function UserRowSkeleton() {
  return (
    <div className="flex items-center gap-3 px-1 py-3">
      <Skeleton className="h-11 w-11" rounded="full" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-3.5 w-28" />
        <Skeleton className="h-3 w-20" />
      </div>
      <Skeleton className="h-9 w-24" rounded="lg" />
    </div>
  );
}

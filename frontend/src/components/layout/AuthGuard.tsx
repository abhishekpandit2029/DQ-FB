"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useMe } from "@/hooks/useMe";
import Skeleton from "@/components/ui/Skeleton";

/**
 * Gates the signed-in area on the API's answer rather than on a cookie.
 *
 * `/users/me` is the only thing that can actually confirm a session — the
 * cookie is httpOnly and scoped to the API's origin, so on a split-domain
 * deployment the frontend can't read it at all.
 */
export default function AuthGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { me, isLoading } = useMe();

  useEffect(() => {
    if (isLoading || me) return;

    // Remember where they were headed so login can send them back.
    const next = encodeURIComponent(pathname);
    router.replace(`/auth/login?next=${next}`);
  }, [isLoading, me, pathname, router]);

  if (isLoading || !me) {
    return (
      <div className="min-h-dvh-safe bg-bg p-4 lap:p-6">
        <div className="mx-auto flex w-full max-w-7xl gap-6">
          <div className="hidden w-60 shrink-0 flex-col gap-2 lap:flex">
            <Skeleton className="mb-4 h-7 w-32" />
            {[0, 1, 2, 3, 4].map((index) => (
              <Skeleton key={index} className="h-10 w-full" />
            ))}
          </div>

          <div className="min-w-0 flex-1 space-y-3">
            <Skeleton className="h-9 w-40" />
            <Skeleton className="h-44 w-full" rounded="lg" />
            <Skeleton className="h-44 w-full" rounded="lg" />
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

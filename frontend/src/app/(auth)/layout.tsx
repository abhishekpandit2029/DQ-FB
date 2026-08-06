import type { ReactNode } from "react";
import Logo from "@/components/layout/Logo";
import AuthArtwork from "@/components/auth/AuthArtwork";

/**
 * Split layout: the form on the left, your illustration on the right.
 *
 * The artwork panel only appears from `lap` up — on a phone the form gets the
 * whole screen, which is what matters there.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-dvh-safe bg-bg lap:grid-cols-2">
      <div className="flex flex-col">
        <header className="px-5 py-5 tab:px-8">
          <Logo priority />
        </header>

        <main className="flex flex-1 items-start justify-center px-5 pb-16 tab:items-center tab:px-8">
          <div className="w-full max-w-sm">{children}</div>
        </main>
      </div>

      <aside className="relative hidden items-center justify-center overflow-hidden bg-surface-muted/50 p-12 lap:flex">
        <div
          className="pointer-events-none absolute inset-0 -z-10 opacity-30 blur-3xl"
          aria-hidden="true"
        >
          <div className="absolute left-1/2 top-1/2 h-[32rem] w-[32rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-tr from-[#ff80b5] to-[#9089fc]" />
        </div>

        <AuthArtwork />
      </aside>
    </div>
  );
}

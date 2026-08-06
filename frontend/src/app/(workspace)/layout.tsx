import type { ReactNode } from "react";
import AuthGuard from "@/components/layout/AuthGuard";
import DashboardShell from "@/components/layout/DashboardShell";
import RealtimeProviders from "@/providers/RealtimeProviders";

/**
 * The signed-in area. Socket and WebRTC only mount here, so the marketing and
 * auth routes never download or run any of that code.
 */
export default function WorkspaceLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGuard>
      <RealtimeProviders>
        <DashboardShell>{children}</DashboardShell>
      </RealtimeProviders>
    </AuthGuard>
  );
}

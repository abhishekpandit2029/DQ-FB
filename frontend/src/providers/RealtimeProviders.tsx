"use client";

import type { ReactNode } from "react";
import { SocketProvider } from "./SocketProvider";
import { CallProvider } from "./CallProvider";
import CallOverlay from "@/components/call/CallOverlay";

/**
 * Socket and calling are only mounted inside the signed-in area — the marketing
 * and auth pages have no session to connect with, and keeping the WebRTC code
 * out of their tree keeps those routes' bundles small.
 */
export default function RealtimeProviders({ children }: { children: ReactNode }) {
  return (
    <SocketProvider>
      <CallProvider>
        {children}
        <CallOverlay />
      </CallProvider>
    </SocketProvider>
  );
}

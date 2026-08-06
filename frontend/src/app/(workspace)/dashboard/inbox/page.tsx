import type { Metadata } from "next";
import { Suspense } from "react";
import InboxView from "@/components/chat/InboxView";

export const metadata: Metadata = {
  title: "Inbox",
  description: "Your conversations.",
};

export default function InboxPage() {
  return (
    <Suspense fallback={null}>
      <InboxView />
    </Suspense>
  );
}

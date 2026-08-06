import type { Metadata } from "next";
import FollowRequestsView from "@/components/social/FollowRequestsView";

export const metadata: Metadata = {
  title: "Requests",
  description: "Approve who can follow, message and call you.",
};

export default function RequestsPage() {
  return <FollowRequestsView />;
}

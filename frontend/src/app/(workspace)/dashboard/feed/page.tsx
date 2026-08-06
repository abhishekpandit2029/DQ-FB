import type { Metadata } from "next";
import FeedView from "@/components/feed/FeedView";

export const metadata: Metadata = {
  title: "Moments",
  description: "Entries from you and the people you follow.",
};

export default function FeedPage() {
  return <FeedView />;
}

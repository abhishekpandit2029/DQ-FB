import type { Metadata } from "next";
import BinView from "@/components/post/BinView";

export const metadata: Metadata = {
  title: "Recycle",
  description: "Entries you've removed.",
};

export default function BinPage() {
  return <BinView />;
}

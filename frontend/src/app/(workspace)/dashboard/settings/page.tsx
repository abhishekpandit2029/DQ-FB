import type { Metadata } from "next";
import SettingsView from "@/components/settings/SettingsView";

export const metadata: Metadata = {
  title: "Adjustments",
  description: "Your account, privacy and appearance settings.",
};

export default function SettingsPage() {
  return <SettingsView />;
}

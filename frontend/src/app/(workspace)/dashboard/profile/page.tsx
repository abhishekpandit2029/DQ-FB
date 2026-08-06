import type { Metadata } from "next";
import ProfileView from "@/components/profile/ProfileView";

export const metadata: Metadata = {
  title: "Persona",
  description: "Your DailyQuill profile and entries.",
};

export default function MyProfilePage() {
  return <ProfileView />;
}

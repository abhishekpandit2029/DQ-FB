import type { Metadata } from "next";
import SignupForm from "@/components/auth/SignupForm";

export const metadata: Metadata = {
  title: "Create your account",
  description: "Start your private daily diary on DailyQuill.",
};

export default function SignupPage() {
  return <SignupForm />;
}

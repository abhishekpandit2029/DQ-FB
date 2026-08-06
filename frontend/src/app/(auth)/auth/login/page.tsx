import type { Metadata } from "next";
import LoginForm from "@/components/auth/LoginForm";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to your DailyQuill diary.",
};

export default function LoginPage() {
  return <LoginForm />;
}

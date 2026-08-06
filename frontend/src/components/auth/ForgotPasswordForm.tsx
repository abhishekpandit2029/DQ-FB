"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api";
import Button from "@/components/ui/Button";
import IconButton from "@/components/ui/IconButton";
import Input from "@/components/ui/Input";
import OtpInput from "@/components/ui/OtpInput";
import { useToast } from "@/components/ui/Toast";
import { EyeIcon, EyeOffIcon } from "@/components/ui/icons";

type Step = "email" | "reset";

/**
 * The code is verified as part of setting the new password, in one request —
 * so a code that has been checked can't be reused by anyone else in between.
 */
export default function ForgotPasswordForm() {
  const router = useRouter();
  const toast = useToast();

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");

  const sendCode = async () => {
    if (!email.trim()) {
      setError("Enter your email to continue");
      return;
    }

    setWorking(true);
    setError("");
    try {
      await api.post("/auth/send-otp", {
        email: email.trim(),
        purpose: "forgot-password",
      });
      setStep("reset");
      toast.success("We sent a code to your email");
    } catch (requestError) {
      setError((requestError as Error).message);
    } finally {
      setWorking(false);
    }
  };

  const resetPassword = async () => {
    if (otp.length !== 6) {
      setError("Enter the 6-digit code");
      return;
    }
    if (password.length < 8) {
      setError("Use at least 8 characters");
      return;
    }

    setWorking(true);
    setError("");
    try {
      await api.post("/auth/update-password", {
        email: email.trim(),
        otp,
        new_password: password,
      });
      toast.success("Password updated — you can sign in now");
      router.replace("/auth/login");
    } catch (requestError) {
      setError((requestError as Error).message);
    } finally {
      setWorking(false);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-content">Reset your password</h1>
      <p className="mt-1.5 text-sm text-muted">
        {step === "email"
          ? "We'll email you a code to confirm it's you."
          : `Enter the code we sent to ${email} and choose a new password.`}
      </p>

      <form
        className="mt-6 space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (step === "email") void sendCode();
          else void resetPassword();
        }}
      >
        {step === "email" ? (
          <Input
            label="Email"
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            error={error}
            autoFocus
            required
          />
        ) : (
          <>
            <OtpInput value={otp} onChange={setOtp} />

            <Input
              label="New password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="At least 8 characters"
              autoComplete="new-password"
              error={error}
              required
              rightSlot={
                <IconButton
                  label={showPassword ? "Hide password" : "Show password"}
                  size="sm"
                  onClick={() => setShowPassword((value) => !value)}
                >
                  {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                </IconButton>
              }
            />

            <button
              type="button"
              onClick={sendCode}
              disabled={working}
              className="w-full text-center text-sm font-medium text-brand hover:underline disabled:opacity-60"
            >
              Send a new code
            </button>
          </>
        )}

        <Button type="submit" fullWidth size="lg" loading={working}>
          {step === "email" ? "Send code" : "Update password"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        Remembered it?{" "}
        <Link href="/auth/login" className="font-medium text-brand hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}

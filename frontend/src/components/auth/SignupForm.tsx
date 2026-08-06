"use client";

import Link from "next/link";
import { useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/providers/AuthProvider";
import Button from "@/components/ui/Button";
import IconButton from "@/components/ui/IconButton";
import Input from "@/components/ui/Input";
import OtpInput from "@/components/ui/OtpInput";
import { useToast } from "@/components/ui/Toast";
import { EyeIcon, EyeOffIcon } from "@/components/ui/icons";

type Step = "email" | "otp" | "details";

const STEP_ORDER: Step[] = ["email", "otp", "details"];

/**
 * Three steps in one component rather than three routes: the state carries
 * across without a navigation, and there's no way to land on step three with
 * an unverified email.
 */
export default function SignupForm() {
  const toast = useToast();
  const { signup, busy } = useAuth();

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
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
      await api.post("/auth/send-otp", { email: email.trim(), purpose: "signup" });
      setStep("otp");
      toast.success("We sent a code to your email");
    } catch (requestError) {
      setError((requestError as Error).message);
    } finally {
      setWorking(false);
    }
  };

  const verifyCode = async (code = otp) => {
    if (code.length !== 6) {
      setError("Enter the 6-digit code");
      return;
    }

    setWorking(true);
    setError("");
    try {
      await api.post("/auth/verify-otp", { email: email.trim(), otp: code });
      setStep("details");
    } catch (requestError) {
      setError((requestError as Error).message);
    } finally {
      setWorking(false);
    }
  };

  const createAccount = async () => {
    if (password.length < 8) {
      setError("Use at least 8 characters");
      return;
    }

    setError("");
    await signup({
      username: username.trim().toLowerCase(),
      email: email.trim(),
      password,
      full_name: fullName.trim() || undefined,
    });
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (step === "email") return void sendCode();
    if (step === "otp") return void verifyCode();
    return void createAccount();
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-content">Start your diary</h1>
      <p className="mt-1.5 text-sm text-muted">
        {step === "email" && "We'll send a code to confirm it's you."}
        {step === "otp" && `Enter the code we sent to ${email}.`}
        {step === "details" && "Last step — pick a name and a password."}
      </p>

      {/* Fixed-height progress rail so steps don't resize the header. */}
      <div className="mt-5 flex gap-1.5" aria-hidden="true">
        {STEP_ORDER.map((item) => (
          <span
            key={item}
            className={`h-1 flex-1 rounded-full transition-colors ${
              STEP_ORDER.indexOf(item) <= STEP_ORDER.indexOf(step)
                ? "bg-brand"
                : "bg-surface-muted"
            }`}
          />
        ))}
      </div>

      <form className="mt-6 space-y-4" onSubmit={submit}>
        {step === "email" && (
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
        )}

        {step === "otp" && (
          <div>
            <OtpInput
              value={otp}
              onChange={setOtp}
              error={error}
              onComplete={(code) => verifyCode(code)}
            />
            <div className="mt-3 flex justify-between text-sm">
              <button
                type="button"
                onClick={() => {
                  setStep("email");
                  setOtp("");
                  setError("");
                }}
                className="font-medium text-muted hover:text-content"
              >
                Change email
              </button>
              <button
                type="button"
                onClick={sendCode}
                disabled={working}
                className="font-medium text-brand hover:underline disabled:opacity-60"
              >
                Resend code
              </button>
            </div>
          </div>
        )}

        {step === "details" && (
          <>
            <Input
              label="Username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="quietmornings"
              hint="Letters, numbers, dots and underscores."
              autoComplete="username"
              maxLength={30}
              autoFocus
              required
            />
            <Input
              label="Display name"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              placeholder="Your name"
              autoComplete="name"
              maxLength={80}
            />
            <Input
              label="Password"
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
          </>
        )}

        <Button type="submit" fullWidth size="lg" loading={working || busy}>
          {step === "email" && "Send code"}
          {step === "otp" && "Verify"}
          {step === "details" && "Create account"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        Already have an account?{" "}
        <Link href="/auth/login" className="font-medium text-brand hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}

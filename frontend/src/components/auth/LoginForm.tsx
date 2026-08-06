"use client";

import Link from "next/link";
import { useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/providers/AuthProvider";
import Button from "@/components/ui/Button";
import IconButton from "@/components/ui/IconButton";
import Input from "@/components/ui/Input";
import OtpInput from "@/components/ui/OtpInput";
import SegmentedControl from "@/components/ui/SegmentedControl";
import { useToast } from "@/components/ui/Toast";
import { EyeIcon, EyeOffIcon } from "@/components/ui/icons";

type Method = "password" | "otp";

/**
 * Sign-in supports both a password and an emailed code. The code path exists so
 * someone who has forgotten their password can still get in without resetting it.
 */
export default function LoginForm() {
  const toast = useToast();
  const { loginWithPassword, loginWithOtp, busy } = useAuth();

  const [method, setMethod] = useState<Method>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const sendCode = async () => {
    if (!email.trim()) {
      setError("Enter your email first");
      return;
    }

    setSending(true);
    setError("");
    try {
      await api.post("/auth/send-otp", { email: email.trim(), purpose: "login" });
      setOtpSent(true);
      toast.success("We sent a code to your email");
    } catch (requestError) {
      setError((requestError as Error).message);
    } finally {
      setSending(false);
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");

    if (method === "password") {
      await loginWithPassword(email.trim(), password);
      return;
    }

    if (!otpSent) {
      await sendCode();
      return;
    }

    await loginWithOtp(email.trim(), otp);
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-content">Welcome back</h1>
      <p className="mt-1.5 text-sm text-muted">Sign in to pick up where you left off.</p>

      <SegmentedControl
        className="mt-6"
        aria-label="Sign in method"
        value={method}
        onChange={(next) => {
          setMethod(next);
          setError("");
          setOtpSent(false);
          setOtp("");
        }}
        options={[
          { value: "password", label: "Password" },
          { value: "otp", label: "Email code" },
        ]}
      />

      <form className="mt-6 space-y-4" onSubmit={submit}>
        <Input
          label="Email"
          type="email"
          inputMode="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          disabled={otpSent}
          required
        />

        {method === "password" ? (
          <>
            <Input
              label="Password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Your password"
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

            <div className="-mt-2 text-right">
              <Link
                href="/auth/forgot-password"
                className="text-sm font-medium text-brand hover:underline"
              >
                Forgot password?
              </Link>
            </div>
          </>
        ) : otpSent ? (
          <div>
            <p className="mb-3 text-sm text-muted">
              Enter the 6-digit code we sent to <strong className="text-content">{email}</strong>.
            </p>
            <OtpInput
              value={otp}
              onChange={setOtp}
              error={error}
              onComplete={(code) => loginWithOtp(email.trim(), code)}
            />
            <button
              type="button"
              onClick={sendCode}
              disabled={sending}
              className="mt-3 w-full text-center text-sm font-medium text-brand hover:underline disabled:opacity-60"
            >
              Send a new code
            </button>
          </div>
        ) : (
          error && <p className="text-sm text-danger">{error}</p>
        )}

        <Button type="submit" fullWidth size="lg" loading={busy || sending}>
          {method === "password" ? "Sign in" : otpSent ? "Verify and sign in" : "Send code"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        New here?{" "}
        <Link href="/auth/signup" className="font-medium text-brand hover:underline">
          Create an account
        </Link>
      </p>
    </div>
  );
}

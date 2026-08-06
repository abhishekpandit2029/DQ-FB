"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";
import login from "@/stuff/login.svg";
import signup from "@/stuff/signup.svg";
import forgotpassword from "@/stuff/forgotpassword.svg";

/** Your illustration for each auth screen, plus a line of supporting copy. */
const ARTWORK = {
  login: {
    src: login,
    title: "Welcome back",
    body: "Your entries are where you left them.",
  },
  signup: {
    src: signup,
    title: "Start your diary",
    body: "A private space for the days worth remembering.",
  },
  forgot: {
    src: forgotpassword,
    title: "Let's get you back in",
    body: "We'll email a code to confirm it's really you.",
  },
} as const;

export default function AuthArtwork() {
  const pathname = usePathname();

  const artwork = pathname.includes("signup")
    ? ARTWORK.signup
    : pathname.includes("forgot-password")
      ? ARTWORK.forgot
      : ARTWORK.login;

  return (
    <div className="flex max-w-md flex-col items-center text-center">
      <Image
        src={artwork.src}
        alt=""
        aria-hidden="true"
        priority
        className="h-auto w-full max-w-sm"
      />

      <h2 className="mt-10 text-2xl font-bold tracking-tight text-content">
        {artwork.title}
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-muted text-balance">
        {artwork.body}
      </p>
    </div>
  );
}

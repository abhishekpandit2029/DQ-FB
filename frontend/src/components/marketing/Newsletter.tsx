"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { BellIcon, ClockIcon } from "@/components/ui/icons";

const PERKS = [
  {
    icon: ClockIcon,
    title: "Weekly articles",
    body: "Writing prompts, journaling habits, and the occasional note on what we've shipped.",
  },
  {
    icon: BellIcon,
    title: "No spam",
    body: "One email a week at most, and an unsubscribe link in every single one.",
  },
];

export default function Newsletter() {
  const toast = useToast();
  const [email, setEmail] = useState("");

  /**
   * There's no mailing-list backend yet, so this acknowledges the address
   * without pretending to have stored it.
   */
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!email.trim()) return;

    toast.info("Newsletter signup isn't wired up yet — but we noted the interest.");
    setEmail("");
  };

  return (
    <section id="subscribe" className="scroll-mt-20 px-5 py-16 tab:px-8 tab:py-24">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-12 rounded-2xl bg-surface p-8 ring-1 ring-line tab:p-12 lap:grid-cols-2">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-content tab:text-4xl">
              Subscribe to our newsletter.
            </h2>
            <p className="mt-4 text-base leading-relaxed text-muted">
              Occasional notes on writing well, keeping a habit, and what&apos;s new in
              DailyQuill.
            </p>

            <form className="mt-7 flex flex-col gap-3 tab:flex-row" onSubmit={submit}>
              <label htmlFor="newsletter-email" className="sr-only">
                Email address
              </label>
              <input
                id="newsletter-email"
                type="email"
                name="email"
                required
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="Enter your email"
                className="h-11 min-w-0 flex-auto rounded-lg bg-surface-muted px-3.5 text-base text-content ring-1 ring-inset ring-line focus:ring-2 focus:ring-brand focus:outline-none tab:text-sm"
              />
              <Button type="submit" size="lg" className="shrink-0">
                Subscribe
              </Button>
            </form>
          </div>

          <dl className="grid gap-8 tab:grid-cols-2">
            {PERKS.map((perk) => (
              <div key={perk.title}>
                <span className="flex h-10 w-10 items-center justify-center rounded-lg text-brand ring-1 ring-brand/30">
                  <perk.icon className="h-5 w-5" />
                </span>
                <dt className="mt-4 text-sm font-semibold text-content">{perk.title}</dt>
                <dd className="mt-2 text-sm leading-relaxed text-muted">{perk.body}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}

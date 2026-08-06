"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { useMe } from "@/hooks/useMe";
import Logo from "@/components/layout/Logo";
import Avatar from "@/components/ui/Avatar";
import Button from "@/components/ui/Button";
import IconButton from "@/components/ui/IconButton";
import Drawer from "@/components/ui/Drawer";
import { MenuIcon } from "@/components/ui/icons";

const LINKS = [
  { href: "#features", label: "Features" },
  { href: "#endorsements", label: "Endorsements" },
  { href: "#subscribe", label: "Subscribe" },
];

export default function MarketingNav() {
  const { me } = useMe();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // The bar picks up a border and blur once the page moves, so it reads as
  // sitting above the content rather than floating in it.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-40 transition-colors duration-200",
        scrolled ? "border-b border-line bg-bg/80 backdrop-blur-md" : "bg-transparent"
      )}
    >
      <nav
        className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 tab:px-6 lap:px-8"
        aria-label="Global"
      >
        <Logo priority />

        <div className="hidden items-center gap-8 lap:flex">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-semibold text-muted transition-colors hover:text-content"
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className="hidden items-center gap-3 lap:flex">
          {me ? (
            <Link
              href="/dashboard/feed"
              className="flex items-center gap-2 rounded-full py-1 pl-1 pr-3 ring-1 ring-line transition-colors hover:bg-surface-muted"
            >
              <Avatar
                src={me.userprofile_image}
                name={me.full_name}
                username={me.username}
                size="xs"
              />
              <span className="text-sm font-semibold text-content">Workspace</span>
            </Link>
          ) : (
            <>
              <Link
                href="/auth/login"
                className="text-sm font-semibold text-content transition-colors hover:text-brand"
              >
                Log in
              </Link>
              <Link href="/auth/signup">
                <Button size="sm">Get started</Button>
              </Link>
            </>
          )}
        </div>

        <IconButton
          label="Open menu"
          className="lap:hidden"
          onClick={() => setMenuOpen(true)}
        >
          <MenuIcon />
        </IconButton>
      </nav>

      <Drawer
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        title="Menu"
        side="right"
      >
        <div className="flex flex-col gap-1 px-4 py-4">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMenuOpen(false)}
              className="rounded-lg px-3 py-3 text-base font-semibold text-content transition-colors hover:bg-surface-muted"
            >
              {link.label}
            </Link>
          ))}

          <hr className="my-3 border-line" />

          {me ? (
            <Link href="/dashboard/feed" onClick={() => setMenuOpen(false)}>
              <Button fullWidth size="lg">
                Go to workspace
              </Button>
            </Link>
          ) : (
            <div className="space-y-2">
              <Link href="/auth/signup" onClick={() => setMenuOpen(false)}>
                <Button fullWidth size="lg">
                  Get started
                </Button>
              </Link>
              <Link href="/auth/login" onClick={() => setMenuOpen(false)}>
                <Button fullWidth size="lg" variant="secondary">
                  Log in
                </Button>
              </Link>
            </div>
          )}
        </div>
      </Drawer>
    </header>
  );
}

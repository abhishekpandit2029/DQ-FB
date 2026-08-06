"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { NAV_LABELS } from "@/constants/app";
import { useAuth } from "@/providers/AuthProvider";
import { useMe } from "@/hooks/useMe";
import Logo from "@/components/layout/Logo";
import Avatar from "@/components/ui/Avatar";
import Button from "@/components/ui/Button";
import IconButton from "@/components/ui/IconButton";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import ComposeEntryModal from "@/components/post/ComposeEntryModal";
import {
  ChatIcon,
  FeedIcon,
  LogoutIcon,
  PlusIcon,
  SettingsIcon,
  TrashIcon,
  UserIcon,
  UserPlusIcon,
} from "@/components/ui/icons";

interface NavItem {
  href: string;
  label: string;
  icon: ReactNode;
  /** Shown as a badge; used for pending follow requests. */
  badge?: number;
}

export default function DashboardShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { logout } = useAuth();
  const { me } = useMe();

  const [composeOpen, setComposeOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);

  const navItems: NavItem[] = [
    { href: "/dashboard/profile", label: NAV_LABELS.profile, icon: <UserIcon /> },
    { href: "/dashboard/feed", label: NAV_LABELS.feed, icon: <FeedIcon /> },
    { href: "/dashboard/inbox", label: NAV_LABELS.inbox, icon: <ChatIcon /> },
    {
      href: "/dashboard/requests",
      label: NAV_LABELS.requests,
      icon: <UserPlusIcon />,
      badge: me?.pendingFollowRequests,
    },
  ];

  const secondaryItems: NavItem[] = [
    { href: "/dashboard/bin", label: NAV_LABELS.bin, icon: <TrashIcon /> },
    { href: "/dashboard/settings", label: NAV_LABELS.settings, icon: <SettingsIcon /> },
  ];

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <div className="min-h-dvh-safe bg-bg">
      {/* ------------------------------- Top bar ------------------------------ */}
      <header className="sticky top-0 z-30 border-b border-line bg-bg/90 backdrop-blur lap:hidden">
        <div className="flex h-14 items-center justify-between gap-3 px-4">
          <Logo href="/dashboard/feed" size="sm" priority />

          <div className="flex items-center gap-1">
            <IconButton label="New entry" onClick={() => setComposeOpen(true)} variant="solid" size="sm">
              <PlusIcon />
            </IconButton>
            <Link href="/dashboard/settings" aria-label="Settings">
              <Avatar
                src={me?.userprofile_image}
                name={me?.full_name}
                username={me?.username}
                size="sm"
              />
            </Link>
          </div>
        </div>
      </header>

      <div className="flex w-full gap-6 px-0 lap:px-6">
        {/* ------------------------- Desktop sidebar ------------------------- */}
        <aside className="sticky top-0 hidden h-dvh-safe w-60 shrink-0 flex-col gap-6 py-6 lap:flex">
          <Logo href="/dashboard/feed" className="px-3" priority />

          <nav className="flex flex-1 flex-col gap-1" aria-label="Main">
            {navItems.map((item) => (
              <SidebarLink key={item.href} item={item} active={isActive(item.href)} />
            ))}

            <hr className="my-3 border-line" />

            {secondaryItems.map((item) => (
              <SidebarLink key={item.href} item={item} active={isActive(item.href)} />
            ))}
          </nav>

          <div className="space-y-3">
            <Button fullWidth leftIcon={<PlusIcon />} onClick={() => setComposeOpen(true)}>
              New entry
            </Button>

            <button
              type="button"
              onClick={() => setLogoutOpen(true)}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted transition-colors hover:bg-surface-muted hover:text-content"
            >
              <LogoutIcon />
              {NAV_LABELS.logout}
            </button>
          </div>
        </aside>

        {/* ---------------------------- Content ----------------------------- */}
        <main className="min-w-0 flex-1 pb-24 lap:py-6 lap:pb-6">{children}</main>
      </div>

      {/* --------------------------- Mobile tab bar -------------------------- */}
      <nav
        className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-bg/95 backdrop-blur pb-safe lap:hidden"
        aria-label="Main"
      >
        <div className="flex items-stretch">
          {navItems.map((item) => (
            <TabBarLink key={item.href} item={item} active={isActive(item.href)} />
          ))}
          <TabBarLink item={secondaryItems[1]} active={isActive(secondaryItems[1].href)} />
        </div>
      </nav>

      <ComposeEntryModal open={composeOpen} onClose={() => setComposeOpen(false)} />

      <ConfirmDialog
        open={logoutOpen}
        onClose={() => setLogoutOpen(false)}
        onConfirm={logout}
        title="Sign out?"
        description="You'll need to sign in again to reach your diary."
        confirmLabel="Sign out"
        danger
      />
    </div>
  );
}

function SidebarLink({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link
      href={item.href}
      prefetch
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
        active ? "bg-brand/10 text-brand" : "text-muted hover:bg-surface-muted hover:text-content"
      )}
    >
      {item.icon}
      <span className="flex-1">{item.label}</span>
      {item.badge ? (
        <span className="rounded-full bg-brand px-1.5 py-0.5 text-[0.6875rem] font-semibold tabular-nums text-white">
          {item.badge > 99 ? "99+" : item.badge}
        </span>
      ) : null}
    </Link>
  );
}

function TabBarLink({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link
      href={item.href}
      prefetch
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[0.6875rem] font-medium transition-colors",
        active ? "text-brand" : "text-muted"
      )}
    >
      <span className="relative text-lg">
        {item.icon}
        {item.badge ? (
          <span className="absolute -right-2 -top-1 min-w-[1rem] rounded-full bg-brand px-1 text-[0.625rem] font-semibold leading-4 text-white">
            {item.badge > 9 ? "9+" : item.badge}
          </span>
        ) : null}
      </span>
      {item.label}
    </Link>
  );
}

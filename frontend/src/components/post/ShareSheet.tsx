"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { SITE_URL } from "@/constants/app";
import type { Post, PublicUser } from "@/lib/types";
import Avatar from "@/components/ui/Avatar";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import Modal from "@/components/ui/Modal";
import { UserRowSkeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { CheckIcon, CopyIcon, ShareIcon, UsersIcon } from "@/components/ui/icons";

export interface ShareSheetProps {
  post: Post;
  open: boolean;
  onClose: () => void;
  onShared?: (shareCount: number) => void;
}

export default function ShareSheet({ post, open, onClose, onShared }: ShareSheetProps) {
  const toast = useToast();
  const [connections, setConnections] = useState<PublicUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);
  const [copied, setCopied] = useState(false);

  const shareUrl = `${SITE_URL}/dashboard/feed/${post._id}`;

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        // People you follow are the ones you're allowed to share into a chat with.
        const result = await api.get<{ users: PublicUser[] }>("/follow/following?limit=50");
        if (!cancelled) setConnections(result.users);
      } catch {
        if (!cancelled) setConnections([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open]);

  const toggle = (userId: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);

      const result = await api.post<{ shareCount: number }>(`/posts/${post._id}/share`);
      onShared?.(result.shareCount);
    } catch (error) {
      toast.error((error as Error).message || "Could not copy the link");
    }
  };

  /** Uses the OS share sheet where available, falling back to copy. */
  const nativeShare = async () => {
    if (typeof navigator.share !== "function") {
      void copyLink();
      return;
    }

    try {
      await navigator.share({ title: post.title, text: post.title, url: shareUrl });
      const result = await api.post<{ shareCount: number }>(`/posts/${post._id}/share`);
      onShared?.(result.shareCount);
    } catch {
      // The user dismissing the share sheet is not an error worth surfacing.
    }
  };

  const sendToSelected = async () => {
    if (selected.size === 0) return;

    setSending(true);
    try {
      await api.post(`/posts/${post._id}/share-to`, { userIds: [...selected] });
      toast.success(`Shared with ${selected.size} ${selected.size === 1 ? "person" : "people"}`);
      setSelected(new Set());
      onClose();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Share this entry"
      size="md"
      footer={
        selected.size > 0 ? (
          <Button fullWidth loading={sending} onClick={sendToSelected}>
            Send to {selected.size} {selected.size === 1 ? "person" : "people"}
          </Button>
        ) : undefined
      }
    >
      <div className="flex gap-2">
        <Button
          variant="secondary"
          fullWidth
          leftIcon={copied ? <CheckIcon /> : <CopyIcon />}
          onClick={copyLink}
        >
          {copied ? "Link copied" : "Copy link"}
        </Button>
        <Button variant="secondary" fullWidth leftIcon={<ShareIcon />} onClick={nativeShare}>
          Share via…
        </Button>
      </div>

      <div className="mt-5">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
          Send to
        </h3>

        {loading ? (
          <div>
            {[0, 1, 2].map((index) => (
              <UserRowSkeleton key={index} />
            ))}
          </div>
        ) : connections.length === 0 ? (
          <EmptyState
            icon={<UsersIcon />}
            title="No connections yet"
            description="Follow someone to share entries directly with them."
          />
        ) : (
          <ul className="-mx-1 max-h-72 overflow-y-auto">
            {connections.map((user) => {
              const isSelected = selected.has(user._id);
              return (
                <li key={user._id}>
                  <button
                    type="button"
                    onClick={() => toggle(user._id)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-1 py-2.5 text-left transition-colors",
                      "hover:bg-surface-muted"
                    )}
                  >
                    <Avatar
                      src={user.userprofile_image}
                      name={user.full_name}
                      username={user.username}
                      size="sm"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-content">
                        {user.full_name || user.username}
                      </p>
                      <p className="truncate text-xs text-muted">@{user.username}</p>
                    </div>

                    <span
                      className={cn(
                        "flex h-5 w-5 shrink-0 items-center justify-center rounded-full ring-1",
                        isSelected
                          ? "bg-brand text-white ring-brand"
                          : "ring-line"
                      )}
                    >
                      {isSelected && <CheckIcon className="h-3.5 w-3.5" />}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Modal>
  );
}

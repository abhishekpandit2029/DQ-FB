"use client";

import Link from "next/link";
import { useState } from "react";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { formatCount, timeAgo } from "@/lib/format";
import type { Post } from "@/lib/types";
import Avatar from "@/components/ui/Avatar";
import Dropdown from "@/components/ui/Dropdown";
import IconButton from "@/components/ui/IconButton";
import Tag from "@/components/ui/Tag";
import { useToast } from "@/components/ui/Toast";
import {
  CommentIcon,
  EditIcon,
  HeartIcon,
  MoreIcon,
  RestoreIcon,
  ShareIcon,
  TrashIcon,
} from "@/components/ui/icons";
import CommentSheet from "./CommentSheet";
import ShareSheet from "./ShareSheet";

export interface PostCardProps {
  post: Post;
  /** Called with the updated post so the parent list can patch its cache. */
  onChange?: (post: Post) => void;
  onDelete?: (postId: string) => void;
  onEdit?: (post: Post) => void;
  onRestore?: (post: Post) => void;
  /** Bin view swaps the actions for restore/delete-forever. */
  variant?: "feed" | "bin";
  isOwner?: boolean;
}

export default function PostCard({
  post,
  onChange,
  onDelete,
  onEdit,
  onRestore,
  variant = "feed",
  isOwner = false,
}: PostCardProps) {
  const toast = useToast();
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  /**
   * The like flips locally first so the tap feels instant, then reconciles with
   * whatever count the server returns. On failure it rolls back.
   */
  const toggleLike = async () => {
    const optimistic: Post = {
      ...post,
      likedByMe: !post.likedByMe,
      likeCount: post.likeCount + (post.likedByMe ? -1 : 1),
    };
    onChange?.(optimistic);

    try {
      const result = await api.post<{ liked: boolean; likeCount: number }>(
        `/posts/${post._id}/like`
      );
      onChange?.({ ...post, likedByMe: result.liked, likeCount: result.likeCount });
    } catch (error) {
      onChange?.(post);
      toast.error((error as Error).message);
    }
  };

  const softDelete = async () => {
    setBusy(true);
    try {
      await api.patch(`/posts/${post._id}`, { isSoftDelete: true });
      onDelete?.(post._id);
      toast.success("Moved to Recycle");
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const restore = async () => {
    setBusy(true);
    try {
      const result = await api.patch<{ post: Post }>(`/posts/${post._id}`, {
        isSoftDelete: false,
      });
      onRestore?.(result.post);
      toast.success("Entry restored");
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const deleteForever = async () => {
    setBusy(true);
    try {
      await api.delete(`/posts/${post._id}`);
      onDelete?.(post._id);
      toast.success("Entry deleted");
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const menuItems =
    variant === "bin"
      ? [
          {
            key: "restore",
            label: "Restore",
            icon: <RestoreIcon />,
            onSelect: restore,
          },
          {
            key: "delete",
            label: "Delete forever",
            icon: <TrashIcon />,
            danger: true,
            onSelect: deleteForever,
          },
        ]
      : [
          { key: "edit", label: "Edit", icon: <EditIcon />, onSelect: () => onEdit?.(post) },
          {
            key: "delete",
            label: "Move to Recycle",
            icon: <TrashIcon />,
            danger: true,
            onSelect: softDelete,
          },
        ];

  return (
    <article className="rounded-xl bg-surface p-4 ring-1 ring-line transition-shadow hover:shadow-sm tab:p-5">
      <header className="flex items-start gap-3">
        <Link href={`/dashboard/u/${post.author.username}`} className="shrink-0">
          <Avatar
            src={post.author.userprofile_image}
            name={post.author.full_name}
            username={post.author.username}
            size="md"
          />
        </Link>

        <div className="min-w-0 flex-1">
          <Link
            href={`/dashboard/u/${post.author.username}`}
            className="block truncate text-sm font-semibold text-content hover:underline"
          >
            {post.author.full_name || post.author.username}
          </Link>
          <p className="truncate text-xs text-muted">
            @{post.author.username} · <time dateTime={post.createdAt}>{timeAgo(post.createdAt)}</time>
          </p>
        </div>

        {isOwner && (
          <Dropdown
            trigger={
              <IconButton label="Entry options" size="sm" disabled={busy}>
                <MoreIcon />
              </IconButton>
            }
            items={menuItems}
          />
        )}
      </header>

      <div className="mt-3">
        <h3 className="text-base font-semibold text-content">{post.title}</h3>
        <p className="mt-1.5 whitespace-pre-wrap break-words text-sm leading-relaxed text-muted">
          {post.content}
        </p>
      </div>

      {post.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {post.tags.map((tag) => (
            <Tag key={tag} tone="brand">
              #{tag}
            </Tag>
          ))}
        </div>
      )}

      {variant === "feed" && (
        <footer className="mt-4 flex items-center gap-1 border-t border-line pt-2">
          <ActionButton
            label={post.likedByMe ? "Unlike" : "Like"}
            active={post.likedByMe}
            activeClass="text-rose-500"
            count={post.likeCount}
            onClick={toggleLike}
            icon={<HeartIcon filled={post.likedByMe} />}
          />
          <ActionButton
            label="Comments"
            count={post.commentCount}
            onClick={() => setCommentsOpen(true)}
            icon={<CommentIcon />}
          />
          <ActionButton
            label="Share"
            count={post.shareCount}
            onClick={() => setShareOpen(true)}
            icon={<ShareIcon />}
          />
        </footer>
      )}

      {/* Sheets mount only once opened, keeping them out of the initial render. */}
      {commentsOpen && (
        <CommentSheet
          post={post}
          open={commentsOpen}
          onClose={() => setCommentsOpen(false)}
          onCountChange={(commentCount) => onChange?.({ ...post, commentCount })}
        />
      )}

      {shareOpen && (
        <ShareSheet
          post={post}
          open={shareOpen}
          onClose={() => setShareOpen(false)}
          onShared={(shareCount) => onChange?.({ ...post, shareCount })}
        />
      )}
    </article>
  );
}

function ActionButton({
  label,
  icon,
  count,
  onClick,
  active,
  activeClass,
}: {
  label: string;
  icon: React.ReactNode;
  count: number;
  onClick: () => void;
  active?: boolean;
  activeClass?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn(
        "flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium",
        "transition-colors hover:bg-surface-muted",
        active ? activeClass : "text-muted"
      )}
    >
      {icon}
      {/* Tabular figures stop the row jiggling as counts change. */}
      <span className="tabular-nums">{count > 0 ? formatCount(count) : ""}</span>
    </button>
  );
}

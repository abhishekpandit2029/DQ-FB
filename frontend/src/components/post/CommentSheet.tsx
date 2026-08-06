"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { formatCount, timeAgo } from "@/lib/format";
import type { Comment, Post } from "@/lib/types";
import Avatar from "@/components/ui/Avatar";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import IconButton from "@/components/ui/IconButton";
import Modal from "@/components/ui/Modal";
import Skeleton from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { CommentIcon, HeartIcon, SendIcon, TrashIcon } from "@/components/ui/icons";

export interface CommentSheetProps {
  post: Post;
  open: boolean;
  onClose: () => void;
  onCountChange?: (commentCount: number) => void;
}

export default function CommentSheet({
  post,
  open,
  onClose,
  onCountChange,
}: CommentSheetProps) {
  const toast = useToast();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [replyTo, setReplyTo] = useState<Comment | null>(null);
  const [total, setTotal] = useState(post.commentCount);

  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.get<{ comments: Comment[]; total: number }>(
        `/posts/${post._id}/comments?limit=50`
      );
      setComments(result.comments);
      setTotal(result.total);
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setLoading(false);
    }
  }, [post._id, toast]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  const submit = async () => {
    const value = text.trim();
    if (!value || sending) return;

    setSending(true);
    try {
      const result = await api.post<{ comment: Comment; commentCount: number }>(
        `/posts/${post._id}/comments`,
        { text: value, parentId: replyTo?._id }
      );

      // Replies slot in under their parent; top-level comments go to the top.
      setComments((current) => {
        if (!replyTo) return [result.comment, ...current];
        const index = current.findIndex((item) => item._id === replyTo._id);
        if (index === -1) return [...current, result.comment];
        const next = [...current];
        next.splice(index + 1, 0, result.comment);
        next[index] = { ...next[index], replyCount: next[index].replyCount + 1 };
        return next;
      });

      setTotal(result.commentCount);
      onCountChange?.(result.commentCount);
      setText("");
      setReplyTo(null);
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setSending(false);
    }
  };

  const toggleLike = async (comment: Comment) => {
    setComments((current) =>
      current.map((item) =>
        item._id === comment._id
          ? {
              ...item,
              likedByMe: !item.likedByMe,
              likeCount: item.likeCount + (item.likedByMe ? -1 : 1),
            }
          : item
      )
    );

    try {
      await api.post(`/posts/comments/${comment._id}/like`);
    } catch (error) {
      void load();
      toast.error((error as Error).message);
    }
  };

  const remove = async (comment: Comment) => {
    try {
      await api.delete(`/posts/comments/${comment._id}`);
      setComments((current) => current.filter((item) => item._id !== comment._id));
      const next = Math.max(0, total - 1);
      setTotal(next);
      onCountChange?.(next);
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Comments${total > 0 ? ` · ${formatCount(total)}` : ""}`}
      size="lg"
      footer={
        <div className="w-full">
          {replyTo && (
            <div className="mb-2 flex items-center justify-between rounded-lg bg-surface-muted px-3 py-1.5 text-xs text-muted">
              <span className="truncate">Replying to @{replyTo.author.username}</span>
              <button
                type="button"
                onClick={() => setReplyTo(null)}
                className="ml-2 shrink-0 font-medium text-brand"
              >
                Cancel
              </button>
            </div>
          )}

          <form
            className="flex items-center gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              void submit();
            }}
          >
            <input
              ref={inputRef}
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder={replyTo ? "Write a reply…" : "Add a comment…"}
              maxLength={1000}
              className="h-11 flex-1 rounded-full bg-surface-muted px-4 text-base text-content ring-1 ring-inset ring-line focus:ring-2 focus:ring-brand focus:outline-none tab:text-sm"
            />
            <Button
              type="submit"
              size="icon"
              loading={sending}
              disabled={!text.trim()}
              aria-label="Post comment"
              className="rounded-full"
            >
              {!sending && <SendIcon />}
            </Button>
          </form>
        </div>
      }
    >
      {loading ? (
        <div className="space-y-4">
          {[0, 1, 2].map((index) => (
            <div key={index} className="flex gap-3">
              <Skeleton className="h-9 w-9" rounded="full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-3 w-full" />
              </div>
            </div>
          ))}
        </div>
      ) : comments.length === 0 ? (
        <EmptyState
          icon={<CommentIcon />}
          title="No comments yet"
          description="Be the first to say something."
        />
      ) : (
        <ul className="space-y-1">
          {comments.map((comment) => (
            <li
              key={comment._id}
              className={cn("flex gap-3 py-2", comment.parent && "ml-8 tab:ml-11")}
            >
              <Link href={`/dashboard/u/${comment.author.username}`} className="shrink-0">
                <Avatar
                  src={comment.author.userprofile_image}
                  name={comment.author.full_name}
                  username={comment.author.username}
                  size={comment.parent ? "xs" : "sm"}
                />
              </Link>

              <div className="min-w-0 flex-1">
                <div className="rounded-2xl bg-surface-muted px-3.5 py-2">
                  <Link
                    href={`/dashboard/u/${comment.author.username}`}
                    className="text-xs font-semibold text-content hover:underline"
                  >
                    {comment.author.full_name || comment.author.username}
                  </Link>
                  <p
                    className={cn(
                      "mt-0.5 whitespace-pre-wrap break-words text-sm",
                      comment.isDeleted ? "italic text-muted" : "text-content"
                    )}
                  >
                    {comment.text}
                  </p>
                </div>

                <div className="mt-1 flex items-center gap-3 px-1 text-xs text-muted">
                  <time dateTime={comment.createdAt}>{timeAgo(comment.createdAt)}</time>

                  {!comment.isDeleted && (
                    <>
                      <button
                        type="button"
                        onClick={() => toggleLike(comment)}
                        className={cn(
                          "flex items-center gap-1 font-medium",
                          comment.likedByMe && "text-rose-500"
                        )}
                      >
                        <HeartIcon filled={comment.likedByMe} className="h-3.5 w-3.5" />
                        {comment.likeCount > 0 && (
                          <span className="tabular-nums">{comment.likeCount}</span>
                        )}
                      </button>

                      {!comment.parent && (
                        <button
                          type="button"
                          className="font-medium"
                          onClick={() => {
                            setReplyTo(comment);
                            inputRef.current?.focus();
                          }}
                        >
                          Reply
                        </button>
                      )}
                    </>
                  )}

                  {comment.isMine && !comment.isDeleted && (
                    <IconButton
                      label="Delete comment"
                      size="sm"
                      className="h-6 w-6"
                      onClick={() => remove(comment)}
                    >
                      <TrashIcon className="h-3.5 w-3.5" />
                    </IconButton>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}

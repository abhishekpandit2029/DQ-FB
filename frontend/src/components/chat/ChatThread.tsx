"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { formatDayLabel, formatTime } from "@/lib/format";
import type { ChatMessage, PublicUser, Relationship } from "@/lib/types";
import { useChat } from "@/hooks/useChat";
import { useMe } from "@/hooks/useMe";
import { useCall } from "@/providers/CallProvider";
import { useSocket } from "@/providers/SocketProvider";
import Avatar from "@/components/ui/Avatar";
import IconButton from "@/components/ui/IconButton";
import Skeleton from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import {
  CheckIcon,
  ChevronLeftIcon,
  PhoneIcon,
  SendIcon,
  VideoIcon,
} from "@/components/ui/icons";

export interface ChatThreadProps {
  chatId: string | null;
  peer: PublicUser;
  relationship?: Relationship;
  /** Mobile shows one pane at a time, so the thread needs a way back. */
  onBack?: () => void;
}

export default function ChatThread({
  chatId,
  peer,
  relationship,
  onBack,
}: ChatThreadProps) {
  const { me } = useMe();
  const { isOnline } = useSocket();
  const call = useCall();
  const toast = useToast();

  const { messages, loading, peerTyping, send, notifyTyping } = useChat({
    chatId,
    peerId: peer._id,
    currentUserId: me?._id,
  });

  const [draft, setDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const typingRef = useRef(false);

  // Stick to the newest message as the conversation grows.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length, peerTyping]);

  const grouped = useMemo(() => groupByDay(messages), [messages]);

  const handleDraftChange = (value: string) => {
    setDraft(value);

    if (value && !typingRef.current) {
      typingRef.current = true;
      notifyTyping(true);
    } else if (!value && typingRef.current) {
      typingRef.current = false;
      notifyTyping(false);
    }
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!draft.trim()) return;

    void send(draft);
    setDraft("");
    typingRef.current = false;
    notifyTyping(false);
  };

  const startCall = (kind: "audio" | "video") => {
    const allowed = kind === "audio" ? relationship?.canAudioCall : relationship?.canVideoCall;
    if (allowed === false) {
      toast.error(
        kind === "audio"
          ? "This person isn't accepting voice calls from you"
          : "This person isn't accepting video calls from you"
      );
      return;
    }
    void call.startCall(peer, kind);
  };

  return (
    <section className="flex h-full min-h-0 flex-col bg-surface">
      {/* -------------------------------- Header ------------------------------ */}
      <header className="flex shrink-0 items-center gap-3 border-b border-line px-3 py-2.5">
        {onBack && (
          <IconButton label="Back to conversations" onClick={onBack} className="lap:hidden">
            <ChevronLeftIcon />
          </IconButton>
        )}

        <Link
          href={`/dashboard/u/${peer.username}`}
          className="flex min-w-0 flex-1 items-center gap-3"
        >
          <Avatar
            src={peer.userprofile_image}
            name={peer.full_name}
            username={peer.username}
            size="sm"
            online={isOnline(peer._id)}
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-content">
              {peer.full_name || peer.username}
            </p>
            {/* Fixed height so the typing indicator doesn't nudge the header. */}
            <p className="h-4 truncate text-xs text-muted">
              {peerTyping
                ? "typing…"
                : isOnline(peer._id)
                  ? "Online"
                  : `@${peer.username}`}
            </p>
          </div>
        </Link>

        <div className="flex shrink-0 items-center gap-1">
          {relationship?.canAudioCall !== false && (
            <IconButton label="Voice call" onClick={() => startCall("audio")}>
              <PhoneIcon />
            </IconButton>
          )}
          {relationship?.canVideoCall !== false && (
            <IconButton label="Video call" onClick={() => startCall("video")}>
              <VideoIcon />
            </IconButton>
          )}
        </div>
      </header>

      {/* ------------------------------ Messages ----------------------------- */}
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-10 w-48" rounded="lg" />
            <Skeleton className="ml-auto h-10 w-40" rounded="lg" />
            <Skeleton className="h-10 w-56" rounded="lg" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
            <Avatar
              src={peer.userprofile_image}
              name={peer.full_name}
              username={peer.username}
              size="lg"
            />
            <div>
              <p className="text-sm font-semibold text-content">
                {peer.full_name || peer.username}
              </p>
              <p className="mt-1 text-xs text-muted">
                This is the start of your conversation.
              </p>
            </div>
          </div>
        ) : (
          grouped.map(([day, dayMessages]) => (
            <div key={day}>
              <div className="my-3 flex justify-center">
                <span className="rounded-full bg-surface-muted px-3 py-1 text-[0.6875rem] font-medium text-muted">
                  {day}
                </span>
              </div>

              <ul className="space-y-1.5">
                {dayMessages.map((message) => (
                  <MessageBubble
                    key={message._id}
                    message={message}
                    mine={message.sender === me?._id}
                  />
                ))}
              </ul>
            </div>
          ))
        )}

        {peerTyping && (
          <div className="mt-2 flex items-center gap-1.5 px-1">
            <span className="flex gap-1 rounded-2xl bg-surface-muted px-3 py-2.5">
              {[0, 150, 300].map((delay) => (
                <span
                  key={delay}
                  className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted"
                  style={{ animationDelay: `${delay}ms` }}
                />
              ))}
            </span>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* ------------------------------ Composer ----------------------------- */}
      <form
        onSubmit={submit}
        className="flex shrink-0 items-center gap-2 border-t border-line px-3 py-2.5 pb-safe [--dq-safe-pb:0.625rem]"
      >
        <input
          value={draft}
          onChange={(event) => handleDraftChange(event.target.value)}
          onBlur={() => {
            if (typingRef.current) {
              typingRef.current = false;
              notifyTyping(false);
            }
          }}
          placeholder="Write a message…"
          maxLength={4000}
          aria-label="Message"
          className="h-11 flex-1 rounded-full bg-surface-muted px-4 text-base text-content ring-1 ring-inset ring-line focus:ring-2 focus:ring-brand focus:outline-none tab:text-sm"
        />
        <IconButton
          label="Send message"
          variant="solid"
          type="submit"
          disabled={!draft.trim()}
        >
          <SendIcon />
        </IconButton>
      </form>
    </section>
  );
}

function MessageBubble({ message, mine }: { message: ChatMessage; mine: boolean }) {
  return (
    <li className={cn("flex", mine ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[80%] rounded-2xl px-3.5 py-2 tab:max-w-[70%]",
          mine
            ? "rounded-br-md bg-brand text-white"
            : "rounded-bl-md bg-surface-muted text-content",
          message.failed && "opacity-60 ring-1 ring-danger"
        )}
      >
        <p className="whitespace-pre-wrap break-words text-sm">{message.text}</p>

        <div
          className={cn(
            "mt-0.5 flex items-center justify-end gap-1 text-[0.625rem]",
            mine ? "text-white/70" : "text-muted"
          )}
        >
          {message.failed ? (
            <span>Not sent</span>
          ) : (
            <>
              <time dateTime={message.createdAt}>{formatTime(message.createdAt)}</time>
              {mine && !message.pending && (
                <CheckIcon
                  className={cn("h-3 w-3", message.readAt && "text-white")}
                  aria-label={message.readAt ? "Read" : "Sent"}
                />
              )}
            </>
          )}
        </div>
      </div>
    </li>
  );
}

/** Buckets messages under Today / Yesterday / a date. */
function groupByDay(messages: ChatMessage[]): Array<[string, ChatMessage[]]> {
  const groups = new Map<string, ChatMessage[]>();

  for (const message of messages) {
    const label = formatDayLabel(message.createdAt);
    const bucket = groups.get(label);
    if (bucket) bucket.push(message);
    else groups.set(label, [message]);
  }

  return [...groups.entries()];
}

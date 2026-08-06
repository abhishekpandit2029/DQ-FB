"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { timeAgo, truncate } from "@/lib/format";
import type { ChatSummary, Relationship } from "@/lib/types";
import { useMe } from "@/hooks/useMe";
import { useSocket } from "@/providers/SocketProvider";
import Avatar from "@/components/ui/Avatar";
import Drawer from "@/components/ui/Drawer";
import EmptyState from "@/components/ui/EmptyState";
import IconButton from "@/components/ui/IconButton";
import { UserRowSkeleton } from "@/components/ui/Skeleton";
import { ChatIcon, PlusIcon } from "@/components/ui/icons";
import DiscoverPanel from "@/components/feed/DiscoverPanel";
import ChatThread from "./ChatThread";

interface ChatsResponse {
  chats: ChatSummary[];
}

/**
 * Two-pane inbox: list and thread side by side on desktop, one at a time on
 * mobile with the thread taking over the screen.
 */
export default function InboxView() {
  const searchParams = useSearchParams();
  const { me } = useMe();
  const { socket, isOnline } = useSocket();

  const { data, isLoading, mutate } = useSWR<ChatsResponse>("/chats");
  const chats = useMemo(() => data?.chats ?? [], [data]);

  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [relationship, setRelationship] = useState<Relationship | undefined>();

  // Arriving from a profile's "Message" button: open (or create) that thread.
  const requestedUserId = searchParams.get("user");

  useEffect(() => {
    if (!requestedUserId) return;

    let cancelled = false;
    (async () => {
      try {
        const existing = chats.find((chat) => chat.user?._id === requestedUserId);
        if (existing) {
          if (!cancelled) setActiveChatId(existing._id);
          return;
        }

        const result = await api.post<{ chat: ChatSummary }>("/chats", {
          userId: requestedUserId,
        });
        await mutate();
        if (!cancelled) setActiveChatId(result.chat._id);
      } catch {
        /* the permission error is already surfaced on the profile */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [requestedUserId, chats, mutate]);

  // New messages reorder the list and update unread counts.
  useEffect(() => {
    const refresh = () => void mutate();

    socket.on("message:new", refresh);
    socket.on("chat:deleted", refresh);

    return () => {
      socket.off("message:new", refresh);
      socket.off("chat:deleted", refresh);
    };
  }, [socket, mutate]);

  const activeChat = chats.find((chat) => chat._id === activeChatId) ?? null;

  // The thread needs to know which call buttons to offer.
  useEffect(() => {
    if (!activeChat?.user) {
      setRelationship(undefined);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const result = await api.get<{ relationship: Relationship }>(
          `/follow/relationship/${activeChat.user!._id}`
        );
        if (!cancelled) setRelationship(result.relationship);
      } catch {
        if (!cancelled) setRelationship(undefined);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeChat?.user]);

  const openChat = async (userId: string) => {
    try {
      const result = await api.post<{ chat: ChatSummary }>("/chats", { userId });
      await mutate();
      setActiveChatId(result.chat._id);
      setNewChatOpen(false);
    } catch {
      /* handled by the toast in the API layer's caller */
    }
  };

  return (
    <div className="h-[calc(100dvh-3.5rem-4rem)] lap:h-[calc(100dvh-3rem)]">
      <div className="grid h-full overflow-hidden rounded-none ring-line lap:grid-cols-[20rem_minmax(0,1fr)] lap:rounded-xl lap:ring-1">
        {/* ----------------------------- Chat list ---------------------------- */}
        <aside
          className={cn(
            "flex min-h-0 flex-col border-line bg-surface lap:border-r",
            // On mobile the list hides once a thread is open.
            activeChat ? "hidden lap:flex" : "flex"
          )}
        >
          <header className="flex shrink-0 items-center justify-between gap-2 border-b border-line px-4 py-3">
            <h1 className="text-base font-semibold text-content">Inbox</h1>
            <IconButton
              label="New conversation"
              variant="solid"
              size="sm"
              onClick={() => setNewChatOpen(true)}
            >
              <PlusIcon />
            </IconButton>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="px-3">
                <UserRowSkeleton />
                <UserRowSkeleton />
                <UserRowSkeleton />
              </div>
            ) : chats.length === 0 ? (
              <EmptyState
                illustrated
                icon={<ChatIcon />}
                title="No conversations yet"
                description="You can message anyone you're connected with."
              />
            ) : (
              <ul>
                {chats.map((chat) => {
                  if (!chat.user) return null;
                  const selected = chat._id === activeChatId;

                  return (
                    <li key={chat._id}>
                      <button
                        type="button"
                        onClick={() => setActiveChatId(chat._id)}
                        className={cn(
                          "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors",
                          selected ? "bg-brand/10" : "hover:bg-surface-muted"
                        )}
                      >
                        <Avatar
                          src={chat.user.userprofile_image}
                          name={chat.user.full_name}
                          username={chat.user.username}
                          size="md"
                          online={isOnline(chat.user._id)}
                        />

                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline justify-between gap-2">
                            <p className="truncate text-sm font-semibold text-content">
                              {chat.user.full_name || chat.user.username}
                            </p>
                            {chat.lastMessageAt && (
                              <time className="shrink-0 text-[0.6875rem] text-muted">
                                {timeAgo(chat.lastMessageAt)}
                              </time>
                            )}
                          </div>

                          <div className="mt-0.5 flex items-center justify-between gap-2">
                            <p className="truncate text-xs text-muted">
                              {chat.lastMessageSender === me?._id && "You: "}
                              {chat.lastMessage
                                ? truncate(chat.lastMessage, 40)
                                : "No messages yet"}
                            </p>
                            {chat.unreadCount > 0 && (
                              <span className="shrink-0 rounded-full bg-brand px-1.5 py-0.5 text-[0.625rem] font-semibold tabular-nums text-white">
                                {chat.unreadCount > 99 ? "99+" : chat.unreadCount}
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </aside>

        {/* ------------------------------ Thread ------------------------------ */}
        <div className={cn("min-h-0", activeChat ? "block" : "hidden lap:block")}>
          {activeChat?.user ? (
            <ChatThread
              chatId={activeChat._id}
              peer={activeChat.user}
              relationship={relationship}
              onBack={() => setActiveChatId(null)}
            />
          ) : (
            <div className="hidden h-full items-center justify-center lap:flex">
              <EmptyState
                icon={<ChatIcon />}
                title="Pick a conversation"
                description="Choose someone on the left, or start a new conversation."
              />
            </div>
          )}
        </div>
      </div>

      <Drawer
        open={newChatOpen}
        onClose={() => setNewChatOpen(false)}
        title="New conversation"
        side="right"
      >
        <div className="px-4 py-4">
          <p className="mb-3 text-xs text-muted">
            You can message people you&apos;re connected with, and anyone who accepts
            messages from everyone.
          </p>
          <DiscoverPanel compact onSelectUser={(user) => openChat(user._id)} />
        </div>
      </Drawer>
    </div>
  );
}

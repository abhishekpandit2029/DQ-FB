"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { emitWithAck } from "@/lib/socket";
import type { ChatMessage } from "@/lib/types";
import { useSocket } from "@/providers/SocketProvider";

interface UseChatOptions {
  chatId: string | null;
  peerId: string | null;
  currentUserId: string | undefined;
}

/**
 * Message state for one open conversation.
 *
 * Sends go out over the socket with an optimistic bubble, reconciled by the
 * `tempId` the server echoes back — so the message appears the instant you hit
 * send rather than after a round trip.
 */
export function useChat({ chatId, peerId, currentUserId }: UseChatOptions) {
  const { socket } = useSocket();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [peerTyping, setPeerTyping] = useState(false);

  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tempIdRef = useRef(0);

  /* ------------------------------ History ------------------------------- */

  useEffect(() => {
    if (!chatId) {
      setMessages([]);
      return;
    }

    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const result = await api.get<{ messages: ChatMessage[] }>(
          `/chats/${chatId}/messages?limit=50`
        );
        if (!cancelled) setMessages(result.messages);
      } catch {
        if (!cancelled) setMessages([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [chatId]);

  /* ---------------------------- Mark as read ---------------------------- */

  useEffect(() => {
    if (!chatId) return;
    socket.emit("message:read", { chatId });
  }, [chatId, socket, messages.length]);

  /* --------------------------- Realtime events -------------------------- */

  useEffect(() => {
    const onNew = (message: ChatMessage) => {
      if (chatId && message.chat !== chatId) return;

      setMessages((current) => {
        // Replace our optimistic copy rather than appending a duplicate.
        if (message.tempId) {
          const index = current.findIndex((item) => item._id === message.tempId);
          if (index !== -1) {
            const next = [...current];
            next[index] = { ...message, pending: false };
            return next;
          }
        }

        if (current.some((item) => item._id === message._id)) return current;
        return [...current, message];
      });
    };

    const onRead = (payload: { chatId: string; readAt: string }) => {
      if (payload.chatId !== chatId) return;
      setMessages((current) =>
        current.map((message) =>
          message.sender === currentUserId && !message.readAt
            ? { ...message, readAt: payload.readAt }
            : message
        )
      );
    };

    const onTyping = (payload: { userId: string; typing: boolean }) => {
      if (payload.userId !== peerId) return;
      setPeerTyping(payload.typing);

      // Clear a stale indicator if the "stopped" event never arrives.
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      if (payload.typing) {
        typingTimerRef.current = setTimeout(() => setPeerTyping(false), 4000);
      }
    };

    socket.on("message:new", onNew);
    socket.on("message:read", onRead);
    socket.on("message:typing", onTyping);

    return () => {
      socket.off("message:new", onNew);
      socket.off("message:read", onRead);
      socket.off("message:typing", onTyping);
    };
  }, [socket, chatId, peerId, currentUserId]);

  /* ------------------------------ Sending ------------------------------- */

  const send = useCallback(
    async (text: string) => {
      const value = text.trim();
      if (!value || !peerId || !currentUserId) return;

      const tempId = `temp-${tempIdRef.current++}`;
      const optimistic: ChatMessage = {
        _id: tempId,
        chat: chatId ?? "",
        sender: currentUserId,
        receiver: peerId,
        text: value,
        readAt: null,
        createdAt: new Date().toISOString(),
        pending: true,
      };

      setMessages((current) => [...current, optimistic]);

      try {
        await emitWithAck("message:send", {
          chatId: chatId ?? undefined,
          receiverId: peerId,
          text: value,
          tempId,
        });
      } catch {
        // Leave the bubble in place but flag it so the failure is visible.
        setMessages((current) =>
          current.map((message) =>
            message._id === tempId ? { ...message, pending: false, failed: true } : message
          )
        );
      }
    },
    [chatId, peerId, currentUserId]
  );

  const notifyTyping = useCallback(
    (typing: boolean) => {
      if (!peerId) return;
      socket.emit("message:typing", { chatId, receiverId: peerId, typing });
    },
    [socket, chatId, peerId]
  );

  return { messages, loading, peerTyping, send, notifyTyping };
}

import type { Server, Socket } from "socket.io";
import Chat from "../models/Chat";
import Message from "../models/Message";
import { persistMessage } from "../controllers/chatController";
import { canInteract } from "../services/relationship";
import { userRoom } from "./registry";
import type { SocketUser } from "./index";

type Ack = (response: { ok: boolean; error?: string; data?: unknown }) => void;

function callAck(ack: unknown, response: { ok: boolean; error?: string; data?: unknown }) {
  if (typeof ack === "function") (ack as Ack)(response);
}

/** Typing indicators are noisy — drop anything faster than this per pair. */
const TYPING_THROTTLE_MS = 1500;

export function registerChatHandlers(io: Server, socket: Socket, user: SocketUser) {
  const lastTypingAt = new Map<string, number>();

  socket.on(
    "message:send",
    async (
      payload: { chatId?: string; receiverId?: string; text?: string; tempId?: string },
      ack?: Ack
    ) => {
      try {
        const text = String(payload?.text ?? "").trim();
        if (!text) return callAck(ack, { ok: false, error: "Write a message first" });
        if (text.length > 4000) {
          return callAck(ack, { ok: false, error: "That message is too long" });
        }

        const { message } = await persistMessage({
          senderId: user.id,
          chatId: payload?.chatId,
          receiverId: payload?.receiverId,
          text,
        });

        const serialized = {
          _id: String(message._id),
          chat: String(message.chat),
          sender: String(message.sender),
          receiver: String(message.receiver),
          text: message.text,
          readAt: null,
          createdAt: message.createdAt,
          // Echoed back so the sender can reconcile its optimistic bubble.
          tempId: payload?.tempId ?? null,
        };

        io.to(userRoom(String(message.receiver))).emit("message:new", serialized);
        io.to(userRoom(user.id)).emit("message:new", serialized);

        callAck(ack, { ok: true, data: serialized });
      } catch (error) {
        callAck(ack, { ok: false, error: (error as Error).message });
      }
    }
  );

  socket.on("message:typing", async (payload: { chatId?: string; receiverId?: string; typing?: boolean }) => {
    const receiverId = payload?.receiverId;
    if (!receiverId) return;

    const key = `${receiverId}:${payload?.typing ? "on" : "off"}`;
    const now = Date.now();
    if (payload?.typing && now - (lastTypingAt.get(key) ?? 0) < TYPING_THROTTLE_MS) return;
    lastTypingAt.set(key, now);

    // A muted/blocked peer shouldn't see typing activity either.
    const permission = await canInteract(user.id, receiverId, "message");
    if (!permission.allowed) return;

    io.to(userRoom(receiverId)).emit("message:typing", {
      chatId: payload?.chatId ?? null,
      userId: user.id,
      typing: Boolean(payload?.typing),
    });
  });

  socket.on("message:read", async (payload: { chatId?: string }, ack?: Ack) => {
    try {
      const chatId = payload?.chatId;
      if (!chatId) return callAck(ack, { ok: false, error: "A chat id is required" });

      const chat = await Chat.findOne({ _id: chatId, participants: user.id }).lean();
      if (!chat) return callAck(ack, { ok: false, error: "Conversation not found" });

      const readAt = new Date();
      const result = await Message.updateMany(
        { chat: chat._id, receiver: user.id, readAt: { $exists: false } },
        { readAt }
      );

      if (result.modifiedCount > 0) {
        const otherId = chat.participants.map(String).find((id) => id !== user.id);
        if (otherId) {
          io.to(userRoom(otherId)).emit("message:read", {
            chatId: String(chat._id),
            readAt,
            by: user.id,
          });
        }
      }

      callAck(ack, { ok: true, data: { updated: result.modifiedCount } });
    } catch (error) {
      callAck(ack, { ok: false, error: (error as Error).message });
    }
  });
}

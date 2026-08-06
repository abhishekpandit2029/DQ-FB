import { Request, Response } from "express";
import { Types } from "mongoose";
import { z } from "zod";
import Chat, { pairKeyOf, sortedPair } from "../models/Chat";
import Message from "../models/Message";
import User from "../models/User";
import { ApiError } from "../utils/ApiError";
import { currentUserId } from "../middleware/auth";
import { assertCanInteract } from "../services/relationship";
import { publicUser } from "../utils/serialize";
import { emitToUser, isUserOnline } from "../sockets/registry";

const objectId = (label: string) =>
  z.string().refine((id) => Types.ObjectId.isValid(id), `Invalid ${label}`);

const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(30),
  before: z.string().datetime().optional(),
});

/**
 * Finds the conversation for a pair, creating it if needed. The permission
 * check runs first so a blocked sender can't even materialise the thread.
 */
export async function findOrCreateChat(userId: string, otherId: string) {
  await assertCanInteract(userId, otherId, "message");

  // Upserting on the unique pair key makes this safe against two people
  // opening the same conversation at the same moment.
  const chat = await Chat.findOneAndUpdate(
    { pairKey: pairKeyOf(userId, otherId) },
    { $setOnInsert: { participants: sortedPair(userId, otherId) } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  return chat;
}

function serializeChat(
  chat: { _id: unknown; participants: unknown[]; lastMessage?: string; lastMessageAt?: Date; lastMessageSender?: unknown; updatedAt?: Date },
  viewerId: string,
  unreadCount = 0
) {
  const other = (chat.participants as Array<Record<string, unknown>>).find(
    (participant) => String(participant?._id ?? participant) !== String(viewerId)
  );

  return {
    _id: String(chat._id),
    user: other && typeof other === "object" && "username" in other ? publicUser(other as never) : null,
    lastMessage: chat.lastMessage ?? "",
    lastMessageAt: chat.lastMessageAt ?? null,
    lastMessageSender: chat.lastMessageSender ? String(chat.lastMessageSender) : null,
    unreadCount,
    online: other ? isUserOnline(String((other as { _id?: unknown })._id ?? other)) : false,
    updatedAt: chat.updatedAt,
  };
}

const createChatSchema = z.object({ userId: objectId("user id") });

export async function createChat(req: Request, res: Response) {
  const viewerId = currentUserId(req);
  const { userId } = createChatSchema.parse(req.body);

  if (viewerId === userId) {
    throw ApiError.badRequest("You cannot start a conversation with yourself");
  }

  const target = await User.findById(userId).select("_id").lean();
  if (!target) throw ApiError.notFound("User not found");

  const chat = await findOrCreateChat(viewerId, userId);
  await chat.populate("participants", "username full_name userprofile_image bio isPrivate");

  res.status(201).json({ success: true, chat: serializeChat(chat as never, viewerId) });
}

/** All conversations for the signed-in user, most recently active first. */
export async function listChats(req: Request, res: Response) {
  const viewerId = currentUserId(req);

  const chats = await Chat.find({ participants: viewerId })
    .populate("participants", "username full_name userprofile_image bio isPrivate")
    .sort({ lastMessageAt: -1, updatedAt: -1 })
    .lean();

  // One grouped count instead of a query per conversation.
  const unread = await Message.aggregate<{ _id: Types.ObjectId; count: number }>([
    {
      $match: {
        receiver: new Types.ObjectId(viewerId),
        readAt: { $exists: false },
        chat: { $in: chats.map((chat) => chat._id) },
      },
    },
    { $group: { _id: "$chat", count: { $sum: 1 } } },
  ]);

  const unreadByChat = new Map(unread.map((row) => [String(row._id), row.count]));

  res.json({
    success: true,
    chats: chats.map((chat) =>
      serializeChat(chat as never, viewerId, unreadByChat.get(String(chat._id)) ?? 0)
    ),
  });
}

function serializeMessage(message: {
  _id: unknown;
  chat: unknown;
  sender: unknown;
  receiver: unknown;
  text: string;
  readAt?: Date;
  createdAt: Date;
}) {
  return {
    _id: String(message._id),
    chat: String(message.chat),
    sender: String(message.sender),
    receiver: String(message.receiver),
    text: message.text,
    readAt: message.readAt ?? null,
    createdAt: message.createdAt,
  };
}

/** Message history for a conversation, newest first, cursor paginated. */
export async function listMessages(req: Request, res: Response) {
  const viewerId = currentUserId(req);
  const { chatId } = req.params;
  const { limit, before } = paginationSchema.parse(req.query);

  if (!Types.ObjectId.isValid(chatId)) throw ApiError.badRequest("Invalid chat id");

  const chat = await Chat.findOne({ _id: chatId, participants: viewerId }).lean();
  if (!chat) throw ApiError.notFound("Conversation not found");

  const messages = await Message.find({
    chat: chat._id,
    ...(before ? { createdAt: { $lt: new Date(before) } } : {}),
  })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  res.json({
    success: true,
    messages: messages.reverse().map(serializeMessage),
    hasMore: messages.length === limit,
  });
}

const sendSchema = z.object({
  chatId: objectId("chat id").optional(),
  receiverId: objectId("user id").optional(),
  text: z.string().trim().min(1, "Write a message first").max(4000),
});

/**
 * REST fallback for sending. The socket path is the primary one, but this
 * keeps sending working if the websocket is down — the realtime fan-out is
 * identical either way.
 */
export async function sendMessage(req: Request, res: Response) {
  const viewerId = currentUserId(req);
  const { chatId, receiverId, text } = sendSchema.parse(req.body);

  if (!chatId && !receiverId) {
    throw ApiError.badRequest("A chat id or receiver id is required");
  }

  const { message, chat } = await persistMessage({
    senderId: viewerId,
    chatId,
    receiverId,
    text,
  });

  const payload = serializeMessage(message);
  emitToUser(String(message.receiver), "message:new", payload);
  emitToUser(viewerId, "message:new", payload);

  res.status(201).json({ success: true, message: payload, chatId: String(chat._id) });
}

/**
 * Shared by the REST route and the socket handler so both enforce the same
 * permission rules and write the same records.
 */
export async function persistMessage(input: {
  senderId: string;
  chatId?: string;
  receiverId?: string;
  text: string;
}) {
  const { senderId, text } = input;

  let chat = input.chatId
    ? await Chat.findOne({ _id: input.chatId, participants: senderId })
    : null;

  if (input.chatId && !chat) throw ApiError.notFound("Conversation not found");

  const receiverId =
    input.receiverId ??
    chat?.participants.map(String).find((id) => id !== String(senderId));

  if (!receiverId) throw ApiError.badRequest("Could not resolve the recipient");

  // Re-checked on every message: the recipient may have tightened their
  // settings or removed the follow since the thread was created.
  await assertCanInteract(senderId, receiverId, "message");

  if (!chat) chat = await findOrCreateChat(senderId, receiverId);

  const message = await Message.create({
    chat: chat._id,
    sender: senderId,
    receiver: receiverId,
    text,
  });

  await Chat.updateOne(
    { _id: chat._id },
    { lastMessage: text, lastMessageAt: message.createdAt, lastMessageSender: senderId }
  );

  return { message, chat };
}

/** Marks everything the viewer received in a conversation as read. */
export async function markRead(req: Request, res: Response) {
  const viewerId = currentUserId(req);
  const { chatId } = req.params;

  if (!Types.ObjectId.isValid(chatId)) throw ApiError.badRequest("Invalid chat id");

  const chat = await Chat.findOne({ _id: chatId, participants: viewerId }).lean();
  if (!chat) throw ApiError.notFound("Conversation not found");

  const readAt = new Date();
  const result = await Message.updateMany(
    { chat: chat._id, receiver: viewerId, readAt: { $exists: false } },
    { readAt }
  );

  if (result.modifiedCount > 0) {
    const otherId = chat.participants.map(String).find((id) => id !== viewerId);
    if (otherId) {
      emitToUser(otherId, "message:read", { chatId: String(chat._id), readAt, by: viewerId });
    }
  }

  res.json({ success: true, updated: result.modifiedCount });
}

export async function deleteChat(req: Request, res: Response) {
  const viewerId = currentUserId(req);
  const { chatId } = req.params;

  if (!Types.ObjectId.isValid(chatId)) throw ApiError.badRequest("Invalid chat id");

  const chat = await Chat.findOne({ _id: chatId, participants: viewerId });
  if (!chat) throw ApiError.notFound("Conversation not found");

  await Message.deleteMany({ chat: chat._id });
  await Chat.deleteOne({ _id: chat._id });

  const otherId = chat.participants.map(String).find((id) => id !== viewerId);
  if (otherId) emitToUser(otherId, "chat:deleted", { chatId: String(chat._id) });

  res.json({ success: true, message: "Conversation deleted" });
}

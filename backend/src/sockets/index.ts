import type { Server as HttpServer } from "http";
import cookie from "cookie";
import { Server, Socket } from "socket.io";
import { env } from "../config/env";
import User from "../models/User";
import { AUTH_COOKIE, extractToken, verifyToken } from "../utils/token";
import { onlineUserIds, setIo, userRoom } from "./registry";
import { registerChatHandlers } from "./chat";
import { registerCallHandlers } from "./calls";

export interface SocketUser {
  id: string;
  username: string;
}

declare module "socket.io" {
  interface Socket {
    currentUser?: SocketUser;
  }
}

export function createSocketServer(httpServer: HttpServer): Server {
  const io = new Server(httpServer, {
    cors: {
      origin: env.corsOrigins,
      credentials: true,
    },
    // Signaling messages are small; the default 1MB buffer is plenty and caps
    // how much a single client can push at once.
    maxHttpBufferSize: 1e6,
    pingInterval: 25000,
    pingTimeout: 20000,
  });

  // Every connection must present a valid session before it can do anything.
  io.use((socket, next) => {
    try {
      const cookies = socket.handshake.headers.cookie
        ? cookie.parse(socket.handshake.headers.cookie)
        : {};

      const token =
        (socket.handshake.auth?.token as string | undefined) ||
        extractToken(
          socket.handshake.headers as unknown as Record<string, unknown>,
          cookies as Record<string, string>
        ) ||
        cookies[AUTH_COOKIE];

      if (!token) return next(new Error("Authentication required"));

      const payload = verifyToken(token);
      socket.currentUser = { id: payload.id, username: payload.username };
      return next();
    } catch {
      return next(new Error("Session expired"));
    }
  });

  io.on("connection", (socket: Socket) => {
    const user = socket.currentUser;
    if (!user) return socket.disconnect(true);

    // All of a user's tabs share one room, so events reach every device.
    socket.join(userRoom(user.id));

    // `presence:update` only reports transitions, so a client that connects
    // after everyone else would never hear about them. Hand this socket the
    // current roster before any broadcast, then announce the arrival.
    socket.emit("presence:snapshot", { userIds: onlineUserIds() });

    markPresence(user.id, true, io);

    registerChatHandlers(io, socket, user);
    registerCallHandlers(io, socket, user);

    socket.on("disconnect", () => {
      // Socket.IO clears this socket's rooms before firing `disconnect`, so
      // whatever is left here is the user's other tabs.
      const stillOpen = io.sockets.adapter.rooms.get(userRoom(user.id));
      if (!stillOpen || stillOpen.size === 0) {
        markPresence(user.id, false, io);
      }
    });
  });

  setIo(io);
  return io;
}

function markPresence(userId: string, online: boolean, io: Server) {
  // Broadcast first and unconditionally: when the DB write below was awaited
  // ahead of the emit, a failed `lastSeenAt` update left the user showing as
  // online to everyone until their next reconnect.
  io.emit("presence:update", { userId, online, at: new Date().toISOString() });

  if (online) return;

  void User.updateOne({ _id: userId }, { lastSeenAt: new Date() }).catch((error: Error) => {
    console.error("[socket] lastSeenAt update failed:", error.message);
  });
}

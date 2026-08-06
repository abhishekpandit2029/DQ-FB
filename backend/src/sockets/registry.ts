import type { Server } from "socket.io";

let io: Server | null = null;

export function setIo(server: Server) {
  io = server;
}

export function getIo(): Server {
  if (!io) throw new Error("Socket.IO server has not been initialised yet");
  return io;
}

const USER_ROOM_PREFIX = "user:";

/** Every socket for a user joins `user:<id>`, so this reaches all their tabs. */
export function userRoom(userId: string) {
  return `${USER_ROOM_PREFIX}${userId}`;
}

/**
 * Ids of every user with at least one live socket.
 *
 * Read straight off the adapter's room map, which is the same source
 * `isUserOnline` uses, so a snapshot can never disagree with a later
 * `presence:update`.
 */
export function onlineUserIds(): string[] {
  const rooms = io?.sockets.adapter.rooms;
  if (!rooms) return [];

  const ids: string[] = [];
  for (const [name, sockets] of rooms) {
    // The map also holds one room per socket id; only the user rooms matter.
    if (name.startsWith(USER_ROOM_PREFIX) && sockets.size > 0) {
      ids.push(name.slice(USER_ROOM_PREFIX.length));
    }
  }
  return ids;
}

/** Fire-and-forget push to a user. Safe to call before the server is ready. */
export function emitToUser(userId: string, event: string, payload: unknown) {
  io?.to(userRoom(String(userId))).emit(event, payload);
}

export function isUserOnline(userId: string): boolean {
  const room = io?.sockets.adapter.rooms.get(userRoom(String(userId)));
  return Boolean(room && room.size > 0);
}

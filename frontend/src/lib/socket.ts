"use client";

import { io, type Socket } from "socket.io-client";
import { API_BASE_URL } from "./api";

let socket: Socket | null = null;

/**
 * One shared connection for the whole app.
 *
 * Authentication rides on the httpOnly session cookie (`withCredentials`), so
 * there is no token to pass in from the client.
 */
export function getSocket(): Socket {
  if (!socket) {
    socket = io(API_BASE_URL, {
      withCredentials: true,
      // Websocket first; polling stays as a fallback for restrictive networks.
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 500,
      reconnectionDelayMax: 5000,
      timeout: 10000,
      autoConnect: false,
    });
  }
  return socket;
}

export function connectSocket(): Socket {
  const instance = getSocket();
  if (!instance.connected) instance.connect();
  return instance;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}

/** Promise wrapper around Socket.IO acknowledgements. */
export function emitWithAck<T = unknown>(
  event: string,
  payload: unknown,
  timeoutMs = 10000
): Promise<T> {
  return new Promise((resolve, reject) => {
    const instance = getSocket();

    const timer = setTimeout(
      () => reject(new Error("The server took too long to respond")),
      timeoutMs
    );

    instance.emit(event, payload, (response: { ok: boolean; error?: string; data?: T }) => {
      clearTimeout(timer);
      if (response?.ok) resolve(response.data as T);
      else reject(new Error(response?.error ?? "Request failed"));
    });
  });
}

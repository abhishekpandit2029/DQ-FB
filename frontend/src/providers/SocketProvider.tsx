"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Socket } from "socket.io-client";
import { connectSocket, disconnectSocket, getSocket } from "@/lib/socket";
import { useMe } from "@/hooks/useMe";

interface SocketContextValue {
  socket: Socket;
  connected: boolean;
  /** Ids currently online, kept up to date by `presence:update`. */
  onlineUsers: Set<string>;
  isOnline: (userId: string) => boolean;
}

const SocketContext = createContext<SocketContextValue | null>(null);

export function SocketProvider({ children }: { children: ReactNode }) {
  const { me } = useMe();
  const [socket, setSocket] = useState<Socket>(() => getSocket());
  const [connected, setConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());

  // The connection is only opened once we know there's a session to attach it
  // to — connecting anonymously would just be rejected by the handshake.
  useEffect(() => {
    if (!me?._id) return;

    // Bind to the instance `connectSocket` hands back rather than one captured
    // on an earlier render: signing out drops the shared socket, so after a
    // sign-out/sign-in the older object is dead and never emits again.
    const active = connectSocket();
    setSocket(active);
    // The socket may already be live by the time this runs, in which case the
    // `connect` event has been and gone.
    setConnected(active.connected);

    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    // Sent by the server on every connection, so a reconnect after a network
    // blip also replaces the roster we missed updates for.
    const onSnapshot = ({ userIds }: { userIds: string[] }) => {
      setOnlineUsers(new Set(userIds));
    };
    const onPresence = ({ userId, online }: { userId: string; online: boolean }) => {
      setOnlineUsers((current) => {
        const next = new Set(current);
        if (online) next.add(userId);
        else next.delete(userId);
        return next;
      });
    };

    active.on("connect", onConnect);
    active.on("disconnect", onDisconnect);
    active.on("presence:snapshot", onSnapshot);
    active.on("presence:update", onPresence);

    return () => {
      active.off("connect", onConnect);
      active.off("disconnect", onDisconnect);
      active.off("presence:snapshot", onSnapshot);
      active.off("presence:update", onPresence);
    };
  }, [me?._id]);

  // Tear the socket down on sign-out so the next user gets a fresh handshake.
  useEffect(() => {
    if (me === undefined) return;
    if (!me) {
      disconnectSocket();
      setConnected(false);
      setOnlineUsers(new Set());
    }
  }, [me]);

  const value = useMemo<SocketContextValue>(
    () => ({
      socket,
      connected,
      onlineUsers,
      isOnline: (userId: string) => onlineUsers.has(userId),
    }),
    [socket, connected, onlineUsers]
  );

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
}

export function useSocket() {
  const context = useContext(SocketContext);
  if (!context) throw new Error("useSocket must be used inside a SocketProvider");
  return context;
}

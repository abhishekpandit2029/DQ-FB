import crypto from "crypto";
import type { Server, Socket } from "socket.io";
import CallLog, { CallKind, CallOutcome } from "../models/CallLog";
import User from "../models/User";
import { canInteract } from "../services/relationship";
import { publicUser } from "../utils/serialize";
import { isUserOnline, userRoom } from "./registry";
import type { SocketUser } from "./index";

type Ack = (response: { ok: boolean; error?: string; data?: unknown }) => void;

function callAck(ack: unknown, response: { ok: boolean; error?: string; data?: unknown }) {
  if (typeof ack === "function") (ack as Ack)(response);
}

interface ActiveCall {
  callId: string;
  callerId: string;
  calleeId: string;
  kind: CallKind;
  startedAt: Date;
  answeredAt?: Date;
  /** Cleared when the callee answers or the call is torn down. */
  ringTimer?: NodeJS.Timeout;
}

/**
 * In-flight calls, keyed by callId. Signaling state is intentionally in memory:
 * a call cannot outlive the process handling it, and the durable record of what
 * happened is written to CallLog on teardown.
 */
const activeCalls = new Map<string, ActiveCall>();

/** Fastest lookup from a participant to the call they're in. */
const callByUser = new Map<string, string>();

const RING_TIMEOUT_MS = 45_000;

function newCallId() {
  return crypto.randomUUID();
}

function peerOf(call: ActiveCall, userId: string) {
  return String(call.callerId) === String(userId) ? call.calleeId : call.callerId;
}

function isParticipant(call: ActiveCall, userId: string) {
  return String(call.callerId) === String(userId) || String(call.calleeId) === String(userId);
}

function clearCall(call: ActiveCall) {
  if (call.ringTimer) clearTimeout(call.ringTimer);
  activeCalls.delete(call.callId);
  if (callByUser.get(call.callerId) === call.callId) callByUser.delete(call.callerId);
  if (callByUser.get(call.calleeId) === call.callId) callByUser.delete(call.calleeId);
}

async function recordCall(call: ActiveCall, outcome: CallOutcome) {
  const endedAt = new Date();
  const durationSec = call.answeredAt
    ? Math.max(0, Math.round((endedAt.getTime() - call.answeredAt.getTime()) / 1000))
    : 0;

  try {
    await CallLog.updateOne(
      { callId: call.callId },
      {
        $setOnInsert: {
          callId: call.callId,
          caller: call.callerId,
          callee: call.calleeId,
          kind: call.kind,
          startedAt: call.startedAt,
        },
        $set: { outcome, answeredAt: call.answeredAt, endedAt, durationSec },
      },
      { upsert: true }
    );
  } catch (error) {
    console.error("[call] failed to record call log:", (error as Error).message);
  }
}

/** Tears a call down, notifies both sides, and writes the log entry once. */
async function endCall(io: Server, call: ActiveCall, outcome: CallOutcome, endedBy?: string) {
  clearCall(call);

  const payload = { callId: call.callId, outcome, endedBy: endedBy ?? null };
  io.to(userRoom(call.callerId)).emit("call:ended", payload);
  io.to(userRoom(call.calleeId)).emit("call:ended", payload);

  await recordCall(call, outcome);
}

export function registerCallHandlers(io: Server, socket: Socket, user: SocketUser) {
  /* ---------------------------------------------------------------------- */
  /*                              Placing a call                            */
  /* ---------------------------------------------------------------------- */

  socket.on(
    "call:invite",
    async (payload: { calleeId?: string; kind?: CallKind }, ack?: Ack) => {
      try {
        const calleeId = String(payload?.calleeId ?? "");
        const kind: CallKind = payload?.kind === "video" ? "video" : "audio";

        if (!calleeId) return callAck(ack, { ok: false, error: "Who are you calling?" });
        if (calleeId === user.id) {
          return callAck(ack, { ok: false, error: "You cannot call yourself" });
        }

        // The callee's own settings decide whether this call may ring at all.
        const permission = await canInteract(user.id, calleeId, kind);
        if (!permission.allowed) {
          return callAck(ack, { ok: false, error: permission.reason ?? "Call not allowed" });
        }

        if (callByUser.has(user.id)) {
          return callAck(ack, { ok: false, error: "You're already on a call" });
        }
        if (callByUser.has(calleeId)) {
          return callAck(ack, { ok: false, error: "They're on another call right now" });
        }
        if (!isUserOnline(calleeId)) {
          return callAck(ack, { ok: false, error: "They're offline right now" });
        }

        const call: ActiveCall = {
          callId: newCallId(),
          callerId: user.id,
          calleeId,
          kind,
          startedAt: new Date(),
        };

        // Stop ringing after a while so a call can't hang open forever.
        call.ringTimer = setTimeout(() => {
          const stillRinging = activeCalls.get(call.callId);
          if (stillRinging && !stillRinging.answeredAt) {
            void endCall(io, stillRinging, "missed");
          }
        }, RING_TIMEOUT_MS);

        activeCalls.set(call.callId, call);
        callByUser.set(user.id, call.callId);
        callByUser.set(calleeId, call.callId);

        const caller = await User.findById(user.id)
          .select("username full_name userprofile_image isPrivate")
          .lean();

        io.to(userRoom(calleeId)).emit("call:incoming", {
          callId: call.callId,
          kind,
          from: caller ? publicUser(caller) : { _id: user.id, username: user.username },
          startedAt: call.startedAt,
          expiresInMs: RING_TIMEOUT_MS,
        });

        callAck(ack, { ok: true, data: { callId: call.callId, kind } });
      } catch (error) {
        callAck(ack, { ok: false, error: (error as Error).message });
      }
    }
  );

  /* ---------------------------------------------------------------------- */
  /*                          Answering / declining                         */
  /* ---------------------------------------------------------------------- */

  socket.on("call:accept", (payload: { callId?: string }, ack?: Ack) => {
    const call = activeCalls.get(String(payload?.callId ?? ""));
    if (!call) return callAck(ack, { ok: false, error: "That call has already ended" });
    if (String(call.calleeId) !== user.id) {
      return callAck(ack, { ok: false, error: "This call isn't for you" });
    }

    call.answeredAt = new Date();
    if (call.ringTimer) {
      clearTimeout(call.ringTimer);
      call.ringTimer = undefined;
    }

    // The caller creates the offer once it knows the callee picked up, so the
    // negotiation never starts against a peer that isn't listening yet.
    io.to(userRoom(call.callerId)).emit("call:accepted", {
      callId: call.callId,
      by: user.id,
    });

    callAck(ack, { ok: true, data: { callId: call.callId, kind: call.kind } });
  });

  socket.on("call:reject", async (payload: { callId?: string }, ack?: Ack) => {
    const call = activeCalls.get(String(payload?.callId ?? ""));
    if (!call) return callAck(ack, { ok: false, error: "That call has already ended" });
    if (!isParticipant(call, user.id)) {
      return callAck(ack, { ok: false, error: "This call isn't for you" });
    }

    await endCall(io, call, "declined", user.id);
    callAck(ack, { ok: true });
  });

  socket.on("call:cancel", async (payload: { callId?: string }, ack?: Ack) => {
    const call = activeCalls.get(String(payload?.callId ?? ""));
    if (!call) return callAck(ack, { ok: true });
    if (String(call.callerId) !== user.id) {
      return callAck(ack, { ok: false, error: "Only the caller can cancel" });
    }

    await endCall(io, call, "cancelled", user.id);
    callAck(ack, { ok: true });
  });

  socket.on("call:end", async (payload: { callId?: string }, ack?: Ack) => {
    const call = activeCalls.get(String(payload?.callId ?? ""));
    if (!call) return callAck(ack, { ok: true });
    if (!isParticipant(call, user.id)) {
      return callAck(ack, { ok: false, error: "This call isn't for you" });
    }

    await endCall(io, call, call.answeredAt ? "answered" : "cancelled", user.id);
    callAck(ack, { ok: true });
  });

  /* ---------------------------------------------------------------------- */
  /*                            WebRTC signaling                            */
  /* ---------------------------------------------------------------------- */

  /**
   * SDP and ICE are relayed verbatim — the server never inspects or rewrites
   * them, it only checks that the sender belongs to the call before forwarding.
   * Media itself is peer-to-peer and never touches this process.
   */
  const relay = (event: string, outgoing: string) => {
    socket.on(event, (payload: { callId?: string; [key: string]: unknown }, ack?: Ack) => {
      const call = activeCalls.get(String(payload?.callId ?? ""));
      if (!call) return callAck(ack, { ok: false, error: "That call has already ended" });
      if (!isParticipant(call, user.id)) {
        return callAck(ack, { ok: false, error: "This call isn't for you" });
      }

      io.to(userRoom(peerOf(call, user.id))).emit(outgoing, {
        ...payload,
        callId: call.callId,
        from: user.id,
      });

      callAck(ack, { ok: true });
    });
  };

  relay("call:offer", "call:offer");
  relay("call:answer", "call:answer");
  relay("call:ice-candidate", "call:ice-candidate");

  // Renegotiation for mid-call changes: camera on/off, screen share, ICE restart.
  relay("call:renegotiate", "call:renegotiate");

  // Lightweight state so the peer can show "camera off" / "muted" instantly
  // rather than waiting to infer it from the media stream.
  socket.on(
    "call:media-state",
    (payload: { callId?: string; audio?: boolean; video?: boolean }) => {
      const call = activeCalls.get(String(payload?.callId ?? ""));
      if (!call || !isParticipant(call, user.id)) return;

      io.to(userRoom(peerOf(call, user.id))).emit("call:media-state", {
        callId: call.callId,
        from: user.id,
        audio: Boolean(payload?.audio),
        video: Boolean(payload?.video),
      });
    }
  );

  /**
   * Connection-quality hints from the peer's RTCStats. Relayed so each side can
   * show a signal indicator and drop to audio-only when the link degrades.
   */
  socket.on(
    "call:quality",
    (payload: { callId?: string; level?: "good" | "fair" | "poor"; rtt?: number; loss?: number }) => {
      const call = activeCalls.get(String(payload?.callId ?? ""));
      if (!call || !isParticipant(call, user.id)) return;

      io.to(userRoom(peerOf(call, user.id))).emit("call:quality", {
        callId: call.callId,
        from: user.id,
        level: payload?.level ?? "good",
        rtt: payload?.rtt ?? null,
        loss: payload?.loss ?? null,
      });
    }
  );

  /* ---------------------------------------------------------------------- */
  /*                               Disconnects                              */
  /* ---------------------------------------------------------------------- */

  socket.on("disconnect", () => {
    const callId = callByUser.get(user.id);
    if (!callId) return;

    const call = activeCalls.get(callId);
    if (!call) return;

    // A brief network blip shouldn't kill a live call — give the other tab a
    // moment to reconnect before tearing it down.
    setTimeout(() => {
      const stillActive = activeCalls.get(callId);
      if (!stillActive) return;
      if (isUserOnline(user.id)) return;

      void endCall(
        io,
        stillActive,
        stillActive.answeredAt ? "answered" : "missed",
        user.id
      );
    }, 5000);
  });
}

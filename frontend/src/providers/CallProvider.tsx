"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { api } from "@/lib/api";
import { emitWithAck } from "@/lib/socket";
import type { CallKind, CallQuality, CallStatus, PublicUser } from "@/lib/types";
import {
  applyEncodingQuality,
  describeMediaError,
  mediaConstraints,
  preferCodecs,
  sampleQuality,
  stopStream,
  tuneOpus,
} from "@/lib/webrtc";
import { useSocket } from "./SocketProvider";
import { useToast } from "@/components/ui/Toast";
import { useMe } from "@/hooks/useMe";

interface CallState {
  status: CallStatus;
  callId: string | null;
  kind: CallKind;
  peer: PublicUser | null;
  /** True when we placed the call, false when we're receiving one. */
  outgoing: boolean;
  micOn: boolean;
  cameraOn: boolean;
  /** What the other side has muted, so the UI can show it. */
  peerMicOn: boolean;
  peerCameraOn: boolean;
  quality: CallQuality;
  startedAt: number | null;
}

interface CallContextValue extends CallState {
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  startCall: (peer: PublicUser, kind: CallKind) => Promise<void>;
  acceptCall: () => Promise<void>;
  rejectCall: () => void;
  endCall: () => void;
  toggleMic: () => void;
  toggleCamera: () => void;
  switchCamera: () => Promise<void>;
}

const INITIAL_STATE: CallState = {
  status: "idle",
  callId: null,
  kind: "audio",
  peer: null,
  outgoing: false,
  micOn: true,
  cameraOn: true,
  peerMicOn: true,
  peerCameraOn: true,
  quality: "good",
  startedAt: null,
};

const CallContext = createContext<CallContextValue | null>(null);

interface IceConfig {
  iceServers: RTCIceServer[];
}

export function CallProvider({ children }: { children: ReactNode }) {
  const { socket } = useSocket();
  const { me } = useMe();
  const toast = useToast();

  const [state, setState] = useState<CallState>(INITIAL_STATE);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  const peerRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const callIdRef = useRef<string | null>(null);
  const iceConfigRef = useRef<IceConfig | null>(null);
  const qualityTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const qualityCountersRef = useRef({ packetsLost: 0, packetsReceived: 0 });
  const facingModeRef = useRef<"user" | "environment">("user");

  /**
   * Perfect-negotiation bookkeeping. Both sides can try to renegotiate at once
   * (turning a camera on, an ICE restart); the "polite" peer backs off so the
   * connection never deadlocks in have-local-offer.
   */
  const politeRef = useRef(false);
  const makingOfferRef = useRef(false);
  const ignoreOfferRef = useRef(false);
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);

  /* ---------------------------------------------------------------------- */
  /*                                Teardown                                */
  /* ---------------------------------------------------------------------- */

  const cleanup = useCallback(() => {
    if (qualityTimerRef.current) {
      clearInterval(qualityTimerRef.current);
      qualityTimerRef.current = null;
    }

    peerRef.current?.getSenders().forEach((sender) => sender.track?.stop());
    peerRef.current?.close();
    peerRef.current = null;

    stopStream(localStreamRef.current);
    localStreamRef.current = null;

    callIdRef.current = null;
    pendingCandidatesRef.current = [];
    makingOfferRef.current = false;
    ignoreOfferRef.current = false;
    qualityCountersRef.current = { packetsLost: 0, packetsReceived: 0 };

    setLocalStream(null);
    setRemoteStream(null);
    setState(INITIAL_STATE);
  }, []);

  /* ---------------------------------------------------------------------- */
  /*                            Peer construction                           */
  /* ---------------------------------------------------------------------- */

  const loadIceConfig = useCallback(async (): Promise<IceConfig> => {
    if (iceConfigRef.current) return iceConfigRef.current;

    try {
      const response = await api.get<{ iceServers: RTCIceServer[] }>("/calls/ice-servers");
      iceConfigRef.current = { iceServers: response.iceServers };
    } catch {
      // A call over STUN alone is better than no call at all.
      iceConfigRef.current = {
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      };
    }

    return iceConfigRef.current;
  }, []);

  const startQualityMonitor = useCallback((peer: RTCPeerConnection) => {
    if (qualityTimerRef.current) clearInterval(qualityTimerRef.current);

    qualityTimerRef.current = setInterval(async () => {
      if (peer.connectionState !== "connected") return;

      try {
        const { sample, counters } = await sampleQuality(peer, qualityCountersRef.current);
        qualityCountersRef.current = counters;

        setState((current) =>
          current.quality === sample.level ? current : { ...current, quality: sample.level }
        );

        // Re-budget the encoders to match what the link can actually carry.
        await applyEncodingQuality(peer, sample.level);

        if (callIdRef.current) {
          socket.emit("call:quality", {
            callId: callIdRef.current,
            level: sample.level,
            rtt: sample.rtt,
            loss: sample.loss,
          });
        }
      } catch {
        /* stats are best effort */
      }
    }, 3000);
  }, [socket]);

  const createPeer = useCallback(
    async (stream: MediaStream, kind: CallKind) => {
      const config = await loadIceConfig();

      const peer = new RTCPeerConnection({
        iceServers: config.iceServers,
        // Pooling warms up candidates before the offer is created, which
        // shaves noticeable time off how long the call takes to connect.
        iceCandidatePoolSize: 4,
        bundlePolicy: "max-bundle",
        rtcpMuxPolicy: "require",
      });

      stream.getTracks().forEach((track) => peer.addTrack(track, stream));
      preferCodecs(peer, kind);

      const incoming = new MediaStream();
      peer.ontrack = (event) => {
        event.streams[0]?.getTracks().forEach((track) => {
          if (!incoming.getTrackById(track.id)) incoming.addTrack(track);
        });
        setRemoteStream(incoming);
      };

      peer.onicecandidate = (event) => {
        if (event.candidate && callIdRef.current) {
          socket.emit("call:ice-candidate", {
            callId: callIdRef.current,
            candidate: event.candidate.toJSON(),
          });
        }
      };

      peer.onnegotiationneeded = async () => {
        if (!callIdRef.current) return;
        try {
          makingOfferRef.current = true;
          await peer.setLocalDescription();
          socket.emit("call:offer", {
            callId: callIdRef.current,
            sdp: peer.localDescription,
          });
        } catch {
          /* negotiation retries on the next event */
        } finally {
          makingOfferRef.current = false;
        }
      };

      peer.onconnectionstatechange = () => {
        if (peer.connectionState === "connected") {
          setState((current) =>
            current.status === "active"
              ? current
              : { ...current, status: "active", startedAt: current.startedAt ?? Date.now() }
          );
          void applyEncodingQuality(peer, "good");
          startQualityMonitor(peer);
        }

        if (peer.connectionState === "failed") {
          // A failed path is often recoverable — re-gather before giving up.
          try {
            peer.restartIce();
          } catch {
            toast.error("The call connection was lost");
            endCallInternal("failed");
          }
        }
      };

      peerRef.current = peer;
      return peer;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [loadIceConfig, socket, startQualityMonitor, toast]
  );

  const endCallInternal = useCallback(
    (reason?: string) => {
      const callId = callIdRef.current;
      if (callId) socket.emit("call:end", { callId });
      cleanup();
      void reason;
    },
    [cleanup, socket]
  );

  /* ---------------------------------------------------------------------- */
  /*                               Public API                               */
  /* ---------------------------------------------------------------------- */

  const startCall = useCallback(
    async (peerUser: PublicUser, kind: CallKind) => {
      if (state.status !== "idle") {
        toast.error("You're already on a call");
        return;
      }
      if (!me) return;

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia(mediaConstraints(kind));
      } catch (error) {
        toast.error(describeMediaError(error, kind));
        return;
      }

      localStreamRef.current = stream;
      setLocalStream(stream);

      // The caller is the impolite peer: on a negotiation clash it keeps its
      // own offer and the callee yields.
      politeRef.current = false;

      setState({
        ...INITIAL_STATE,
        status: "ringing",
        kind,
        peer: peerUser,
        outgoing: true,
        cameraOn: kind === "video",
      });

      try {
        const result = await emitWithAck<{ callId: string }>("call:invite", {
          calleeId: peerUser._id,
          kind,
        });

        callIdRef.current = result.callId;
        setState((current) => ({ ...current, callId: result.callId }));
      } catch (error) {
        stopStream(stream);
        cleanup();
        toast.error((error as Error).message);
      }
    },
    [cleanup, me, state.status, toast]
  );

  const acceptCall = useCallback(async () => {
    const callId = callIdRef.current;
    if (!callId || state.status !== "incoming") return;

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia(mediaConstraints(state.kind));
    } catch (error) {
      toast.error(describeMediaError(error, state.kind));
      socket.emit("call:reject", { callId });
      cleanup();
      return;
    }

    localStreamRef.current = stream;
    setLocalStream(stream);

    // The callee is the polite peer.
    politeRef.current = true;

    await createPeer(stream, state.kind);

    setState((current) => ({
      ...current,
      status: "connecting",
      cameraOn: current.kind === "video",
    }));

    try {
      await emitWithAck("call:accept", { callId });
    } catch (error) {
      toast.error((error as Error).message);
      cleanup();
    }
  }, [cleanup, createPeer, socket, state.kind, state.status, toast]);

  const rejectCall = useCallback(() => {
    const callId = callIdRef.current;
    if (callId) socket.emit("call:reject", { callId });
    cleanup();
  }, [cleanup, socket]);

  const endCall = useCallback(() => {
    const callId = callIdRef.current;
    if (!callId) {
      cleanup();
      return;
    }

    // Before pickup this is a cancel; after it, a hang-up.
    socket.emit(state.status === "ringing" ? "call:cancel" : "call:end", { callId });
    cleanup();
  }, [cleanup, socket, state.status]);

  const toggleMic = useCallback(() => {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (!track) return;

    track.enabled = !track.enabled;
    setState((current) => {
      if (callIdRef.current) {
        socket.emit("call:media-state", {
          callId: callIdRef.current,
          audio: track.enabled,
          video: current.cameraOn,
        });
      }
      return { ...current, micOn: track.enabled };
    });
  }, [socket]);

  const toggleCamera = useCallback(() => {
    const track = localStreamRef.current?.getVideoTracks()[0];
    if (!track) return;

    track.enabled = !track.enabled;
    setState((current) => {
      if (callIdRef.current) {
        socket.emit("call:media-state", {
          callId: callIdRef.current,
          audio: current.micOn,
          video: track.enabled,
        });
      }
      return { ...current, cameraOn: track.enabled };
    });
  }, [socket]);

  /** Front/rear camera swap — replaces the track in place, no renegotiation. */
  const switchCamera = useCallback(async () => {
    const peer = peerRef.current;
    const stream = localStreamRef.current;
    if (!peer || !stream || state.kind !== "video") return;

    const next = facingModeRef.current === "user" ? "environment" : "user";

    try {
      const replacement = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: next }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });

      const newTrack = replacement.getVideoTracks()[0];
      const sender = peer.getSenders().find((item) => item.track?.kind === "video");
      if (!sender || !newTrack) return;

      await sender.replaceTrack(newTrack);

      stream.getVideoTracks().forEach((track) => {
        stream.removeTrack(track);
        track.stop();
      });
      stream.addTrack(newTrack);

      facingModeRef.current = next;
      setLocalStream(new MediaStream(stream.getTracks()));
    } catch {
      toast.error("Could not switch camera");
    }
  }, [state.kind, toast]);

  /* ---------------------------------------------------------------------- */
  /*                             Signaling wiring                           */
  /* ---------------------------------------------------------------------- */

  useEffect(() => {
    if (!me) return;

    const onIncoming = (payload: {
      callId: string;
      kind: CallKind;
      from: PublicUser;
    }) => {
      // Already busy: decline immediately so their phone stops ringing.
      if (callIdRef.current) {
        socket.emit("call:reject", { callId: payload.callId });
        return;
      }

      callIdRef.current = payload.callId;
      setState({
        ...INITIAL_STATE,
        status: "incoming",
        callId: payload.callId,
        kind: payload.kind,
        peer: payload.from,
        outgoing: false,
      });
    };

    /** They picked up — as the caller we now build the peer and offer. */
    const onAccepted = async () => {
      const stream = localStreamRef.current;
      if (!stream) return;

      setState((current) => ({ ...current, status: "connecting" }));

      const peer = await createPeer(stream, state.kind);

      try {
        makingOfferRef.current = true;
        const offer = await peer.createOffer();
        offer.sdp = offer.sdp ? tuneOpus(offer.sdp) : offer.sdp;
        await peer.setLocalDescription(offer);

        socket.emit("call:offer", {
          callId: callIdRef.current,
          sdp: peer.localDescription,
        });
      } finally {
        makingOfferRef.current = false;
      }
    };

    const onOffer = async (payload: { sdp: RTCSessionDescriptionInit }) => {
      const peer = peerRef.current;
      if (!peer) return;

      // Perfect negotiation: if an offer arrives while we have one in flight,
      // only the polite side rolls back.
      const offerCollision =
        makingOfferRef.current || peer.signalingState !== "stable";

      ignoreOfferRef.current = !politeRef.current && offerCollision;
      if (ignoreOfferRef.current) return;

      try {
        await peer.setRemoteDescription(new RTCSessionDescription(payload.sdp));

        for (const candidate of pendingCandidatesRef.current) {
          await peer.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => undefined);
        }
        pendingCandidatesRef.current = [];

        const answer = await peer.createAnswer();
        answer.sdp = answer.sdp ? tuneOpus(answer.sdp) : answer.sdp;
        await peer.setLocalDescription(answer);

        socket.emit("call:answer", {
          callId: callIdRef.current,
          sdp: peer.localDescription,
        });
      } catch {
        /* the peer will renegotiate */
      }
    };

    const onAnswer = async (payload: { sdp: RTCSessionDescriptionInit }) => {
      const peer = peerRef.current;
      if (!peer || peer.signalingState === "stable") return;

      try {
        await peer.setRemoteDescription(new RTCSessionDescription(payload.sdp));

        for (const candidate of pendingCandidatesRef.current) {
          await peer.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => undefined);
        }
        pendingCandidatesRef.current = [];
      } catch {
        /* ignore */
      }
    };

    const onCandidate = async (payload: { candidate: RTCIceCandidateInit }) => {
      const peer = peerRef.current;
      if (!payload.candidate) return;

      // Candidates can arrive before the remote description is set.
      if (!peer || !peer.remoteDescription) {
        pendingCandidatesRef.current.push(payload.candidate);
        return;
      }

      try {
        await peer.addIceCandidate(new RTCIceCandidate(payload.candidate));
      } catch {
        if (!ignoreOfferRef.current) pendingCandidatesRef.current.push(payload.candidate);
      }
    };

    const onMediaState = (payload: { audio: boolean; video: boolean }) => {
      setState((current) => ({
        ...current,
        peerMicOn: payload.audio,
        peerCameraOn: payload.video,
      }));
    };

    const onEnded = (payload: { outcome: string }) => {
      const messages: Record<string, string> = {
        declined: "Call declined",
        missed: "No answer",
        cancelled: "Call cancelled",
        failed: "The call could not connect",
      };
      if (messages[payload.outcome]) toast.info(messages[payload.outcome]);
      cleanup();
    };

    socket.on("call:incoming", onIncoming);
    socket.on("call:accepted", onAccepted);
    socket.on("call:offer", onOffer);
    socket.on("call:answer", onAnswer);
    socket.on("call:ice-candidate", onCandidate);
    socket.on("call:media-state", onMediaState);
    socket.on("call:ended", onEnded);

    return () => {
      socket.off("call:incoming", onIncoming);
      socket.off("call:accepted", onAccepted);
      socket.off("call:offer", onOffer);
      socket.off("call:answer", onAnswer);
      socket.off("call:ice-candidate", onCandidate);
      socket.off("call:media-state", onMediaState);
      socket.off("call:ended", onEnded);
    };
  }, [cleanup, createPeer, me, socket, state.kind, toast]);

  // Hang up cleanly if the tab is closed mid-call.
  useEffect(() => {
    const onUnload = () => {
      if (callIdRef.current) socket.emit("call:end", { callId: callIdRef.current });
    };
    window.addEventListener("pagehide", onUnload);
    return () => window.removeEventListener("pagehide", onUnload);
  }, [socket]);

  useEffect(() => cleanup, [cleanup]);

  const value = useMemo<CallContextValue>(
    () => ({
      ...state,
      localStream,
      remoteStream,
      startCall,
      acceptCall,
      rejectCall,
      endCall,
      toggleMic,
      toggleCamera,
      switchCamera,
    }),
    [
      state,
      localStream,
      remoteStream,
      startCall,
      acceptCall,
      rejectCall,
      endCall,
      toggleMic,
      toggleCamera,
      switchCamera,
    ]
  );

  return <CallContext.Provider value={value}>{children}</CallContext.Provider>;
}

export function useCall() {
  const context = useContext(CallContext);
  if (!context) throw new Error("useCall must be used inside a CallProvider");
  return context;
}

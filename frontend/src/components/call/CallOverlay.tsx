"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";
import { formatDuration } from "@/lib/format";
import { useCall } from "@/providers/CallProvider";
import { useMounted } from "@/hooks/useMounted";
import Avatar from "@/components/ui/Avatar";
import IconButton from "@/components/ui/IconButton";
import {
  MicIcon,
  MicOffIcon,
  PhoneIcon,
  PhoneOffIcon,
  SignalIcon,
  SwitchCameraIcon,
  VideoIcon,
  VideoOffIcon,
} from "@/components/ui/icons";

const QUALITY_STYLE = {
  good: "text-emerald-400",
  fair: "text-amber-400",
  poor: "text-red-400",
};

const QUALITY_LABEL = {
  good: "Good connection",
  fair: "Unstable connection",
  poor: "Poor connection",
};

export default function CallOverlay() {
  const call = useCall();
  const mounted = useMounted();

  if (!mounted || call.status === "idle") return null;

  return createPortal(
    call.status === "incoming" ? <IncomingCall /> : <ActiveCall />,
    document.body
  );
}

/* -------------------------------------------------------------------------- */
/*                              Incoming ringer                               */
/* -------------------------------------------------------------------------- */

function IncomingCall() {
  const { peer, kind, acceptCall, rejectCall } = useCall();

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-[#1e1b4b]/60 p-4 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-sm rounded-2xl bg-surface p-6 text-center shadow-2xl animate-scale-in">
        <Avatar
          src={peer?.userprofile_image}
          name={peer?.full_name}
          username={peer?.username}
          size="xl"
          className="mx-auto"
        />

        <h2 className="mt-4 text-lg font-semibold text-content">
          {peer?.full_name || peer?.username}
        </h2>
        <p className="mt-1 text-sm text-muted">
          Incoming {kind === "video" ? "video" : "voice"} call
        </p>

        <div className="mt-8 flex items-center justify-center gap-10">
          <button
            type="button"
            onClick={rejectCall}
            className="flex flex-col items-center gap-2"
          >
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-danger text-white transition-transform active:scale-95">
              <PhoneOffIcon className="h-6 w-6" />
            </span>
            <span className="text-xs font-medium text-muted">Decline</span>
          </button>

          <button
            type="button"
            onClick={acceptCall}
            className="flex flex-col items-center gap-2"
          >
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 text-white transition-transform active:scale-95">
              {kind === "video" ? (
                <VideoIcon className="h-6 w-6" />
              ) : (
                <PhoneIcon className="h-6 w-6" />
              )}
            </span>
            <span className="text-xs font-medium text-muted">Accept</span>
          </button>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                                Active call                                 */
/* -------------------------------------------------------------------------- */

function ActiveCall() {
  const {
    status,
    kind,
    peer,
    quality,
    micOn,
    cameraOn,
    peerCameraOn,
    peerMicOn,
    startedAt,
    localStream,
    remoteStream,
    endCall,
    toggleMic,
    toggleCamera,
    switchCamera,
  } = useCall();

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
    // Audio-only calls still need an element to actually play the remote track.
    if (remoteAudioRef.current && remoteStream) {
      remoteAudioRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  useEffect(() => {
    if (status !== "active" || !startedAt) return;

    const tick = () => setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [status, startedAt]);

  const statusLabel =
    status === "ringing"
      ? "Ringing…"
      : status === "connecting"
        ? "Connecting…"
        : formatDuration(elapsed);

  const showRemoteVideo = kind === "video" && peerCameraOn && Boolean(remoteStream);

  return (
    // A deep indigo rather than black: a call still needs a dark, low-glare
    // surface so the video is what you look at, but it stays in the brand's
    // colour family instead of dropping to a flat black screen.
    <div className="fixed inset-0 z-[90] flex flex-col bg-gradient-to-b from-[#1e1b4b] to-[#312e81] text-white animate-fade-in">
      {/* Audio sink — always mounted so voice calls have somewhere to play. */}
      <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />

      <header className="flex items-center justify-between gap-3 px-4 py-3 pt-safe">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">
            {peer?.full_name || peer?.username}
          </p>
          <p className="text-xs tabular-nums text-white/60">{statusLabel}</p>
        </div>

        {status === "active" && (
          <span
            className={cn("flex items-center gap-1 text-xs", QUALITY_STYLE[quality])}
            title={QUALITY_LABEL[quality]}
          >
            <SignalIcon className="h-4 w-4" />
            <span className="hidden tab:inline">{QUALITY_LABEL[quality]}</span>
          </span>
        )}
      </header>

      <div className="relative min-h-0 flex-1">
        {showRemoteVideo ? (
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="h-full w-full bg-[#1e1b4b] object-cover"
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-4 px-6">
            <Avatar
              src={peer?.userprofile_image}
              name={peer?.full_name}
              username={peer?.username}
              size="xl"
            />
            <p className="text-sm text-white/70">
              {kind === "video" && !peerCameraOn
                ? "Their camera is off"
                : status === "active"
                  ? "Voice call in progress"
                  : statusLabel}
            </p>
            {!peerMicOn && status === "active" && (
              <span className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs">
                <MicOffIcon className="h-3.5 w-3.5" />
                Muted
              </span>
            )}
          </div>
        )}

        {/* Self view — mirrored, and muted so you never hear yourself. */}
        {kind === "video" && localStream && (
          <div className="absolute bottom-4 right-4 h-40 w-28 overflow-hidden rounded-xl bg-[#1e1b4b] shadow-lg ring-1 ring-white/20 tab:h-48 tab:w-36">
            {cameraOn ? (
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="h-full w-full -scale-x-100 object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-white/50">
                <VideoOffIcon className="h-6 w-6" />
              </div>
            )}
          </div>
        )}
      </div>

      <footer className="flex items-center justify-center gap-4 px-4 py-6 pb-safe [--dq-safe-pb:1.5rem] tab:gap-6">
        <IconButton
          label={micOn ? "Mute microphone" : "Unmute microphone"}
          onClick={toggleMic}
          className={cn(
            "h-14 w-14",
            micOn ? "bg-white/15 text-white hover:bg-white/25" : "bg-white text-[#1e1b4b]"
          )}
        >
          {micOn ? <MicIcon className="h-6 w-6" /> : <MicOffIcon className="h-6 w-6" />}
        </IconButton>

        {kind === "video" && (
          <>
            <IconButton
              label={cameraOn ? "Turn camera off" : "Turn camera on"}
              onClick={toggleCamera}
              className={cn(
                "h-14 w-14",
                cameraOn ? "bg-white/15 text-white hover:bg-white/25" : "bg-white text-[#1e1b4b]"
              )}
            >
              {cameraOn ? (
                <VideoIcon className="h-6 w-6" />
              ) : (
                <VideoOffIcon className="h-6 w-6" />
              )}
            </IconButton>

            <IconButton
              label="Switch camera"
              onClick={switchCamera}
              className="h-14 w-14 bg-white/15 text-white hover:bg-white/25"
            >
              <SwitchCameraIcon className="h-6 w-6" />
            </IconButton>
          </>
        )}

        <IconButton
          label="End call"
          onClick={endCall}
          className="h-14 w-14 bg-danger text-white hover:opacity-90"
        >
          <PhoneOffIcon className="h-6 w-6" />
        </IconButton>
      </footer>
    </div>
  );
}

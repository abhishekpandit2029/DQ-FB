import type { CallKind, CallQuality } from "./types";

/* -------------------------------------------------------------------------- */
/*                              Media constraints                             */
/* -------------------------------------------------------------------------- */

/**
 * Audio is the part users actually notice, so the browser's three processing
 * stages are all requested explicitly rather than left to defaults:
 *
 * - echoCancellation stops the far end hearing themselves through your speakers
 * - noiseSuppression removes steady background hiss (fans, traffic)
 * - autoGainControl keeps a quiet talker audible without clipping a loud one
 *
 * Mono at 48kHz matches what Opus encodes anyway — asking for stereo would
 * double the bitrate for no perceptible gain on speech.
 */
export const AUDIO_CONSTRAINTS: MediaTrackConstraints = {
  echoCancellation: { ideal: true },
  noiseSuppression: { ideal: true },
  autoGainControl: { ideal: true },
  channelCount: { ideal: 1 },
  sampleRate: { ideal: 48000 },
};

/**
 * 720p30 is the sweet spot: noticeably sharper than 480p, but roughly a
 * quarter of the bitrate of 1080p. `ideal` rather than `exact` so a device
 * that can't manage it degrades instead of failing outright.
 */
export const VIDEO_CONSTRAINTS: MediaTrackConstraints = {
  width: { ideal: 1280, max: 1920 },
  height: { ideal: 720, max: 1080 },
  frameRate: { ideal: 30, max: 30 },
  facingMode: "user",
};

export function mediaConstraints(kind: CallKind): MediaStreamConstraints {
  return {
    audio: AUDIO_CONSTRAINTS,
    video: kind === "video" ? VIDEO_CONSTRAINTS : false,
  };
}

/* -------------------------------------------------------------------------- */
/*                                  Bitrates                                  */
/* -------------------------------------------------------------------------- */

/** Target video bitrates in bits per second, by measured link quality. */
const VIDEO_BITRATE: Record<CallQuality, number> = {
  good: 1_500_000,
  fair: 700_000,
  poor: 250_000,
};

/** How much to shrink the sent resolution when the link is struggling. */
const VIDEO_SCALE_DOWN: Record<CallQuality, number> = {
  good: 1,
  fair: 1.5,
  poor: 3,
};

const AUDIO_BITRATE = 32_000; // Opus speech sounds transparent well below this.

/**
 * Applies the encoding budget for the current link quality.
 *
 * Without this the browser will happily push its default ceiling into a
 * connection that can't carry it, which is what produces frozen video and
 * choppy audio rather than a gracefully softer picture.
 */
export async function applyEncodingQuality(
  peer: RTCPeerConnection,
  quality: CallQuality
) {
  for (const sender of peer.getSenders()) {
    if (!sender.track) continue;

    const parameters = sender.getParameters();
    if (!parameters.encodings || parameters.encodings.length === 0) {
      parameters.encodings = [{}];
    }

    if (sender.track.kind === "video") {
      parameters.encodings[0].maxBitrate = VIDEO_BITRATE[quality];
      parameters.encodings[0].scaleResolutionDownBy = VIDEO_SCALE_DOWN[quality];
      // Prefer dropping frames over turning the picture to mush during motion.
      (parameters as { degradationPreference?: string }).degradationPreference =
        "balanced";
    } else {
      parameters.encodings[0].maxBitrate = AUDIO_BITRATE;
      // Audio is the last thing that should be starved on a bad link.
      parameters.encodings[0].priority = "high";
      (parameters.encodings[0] as { networkPriority?: string }).networkPriority = "high";
    }

    try {
      await sender.setParameters(parameters);
    } catch {
      // Older browsers reject some fields; the call still works without them.
    }
  }
}

/* -------------------------------------------------------------------------- */
/*                              Codec preferences                             */
/* -------------------------------------------------------------------------- */

/**
 * Nudges the codec negotiation toward the ones that behave best here.
 *
 * VP8 and H.264 are the two with near-universal hardware acceleration, which
 * matters more than raw compression on phones — a software VP9 encode drains
 * the battery and thermally throttles into a worse picture than accelerated VP8.
 */
/** Minimal shape of a codec entry — the DOM lib name for this varies by TS version. */
interface CodecCapability {
  mimeType: string;
}

export function preferCodecs(peer: RTCPeerConnection, kind: CallKind) {
  if (typeof RTCRtpSender.getCapabilities !== "function") return;

  for (const transceiver of peer.getTransceivers()) {
    const trackKind = transceiver.sender.track?.kind;
    if (!trackKind) continue;
    if (typeof transceiver.setCodecPreferences !== "function") continue;

    const capabilities = RTCRtpSender.getCapabilities(trackKind);
    if (!capabilities?.codecs?.length) continue;

    const rank = (codec: CodecCapability) => {
      const name = codec.mimeType.toLowerCase();
      if (trackKind === "audio") {
        if (name.endsWith("opus")) return 0;
        return 5;
      }
      if (name.endsWith("vp8")) return 0;
      if (name.endsWith("h264")) return 1;
      if (name.endsWith("vp9")) return 2;
      return 5;
    };

    const ordered = [...capabilities.codecs].sort((a, b) => rank(a) - rank(b));

    try {
      transceiver.setCodecPreferences(ordered);
    } catch {
      // Not fatal — the browser falls back to its own ordering.
    }
  }

  void kind;
}

/**
 * Turns on the Opus features that make speech resilient, which the SDP does not
 * enable by default:
 *
 * - `useinbandfec=1` carries redundant data so a lost packet doesn't gap
 * - `usedtx=1` stops sending during silence, freeing bandwidth for whoever is talking
 * - `stereo=0` keeps it mono, matching the captured track
 */
export function tuneOpus(sdp: string): string {
  return sdp.replace(
    /a=fmtp:(\d+) ([^\r\n]*minptime[^\r\n]*)/g,
    (match, payload: string, params: string) => {
      const additions = ["stereo=0", "useinbandfec=1", "usedtx=1"];
      const merged = [params, ...additions.filter((item) => !params.includes(item.split("=")[0]))];
      return `a=fmtp:${payload} ${merged.join(";")}`;
    }
  );
}

/* -------------------------------------------------------------------------- */
/*                              Quality sampling                              */
/* -------------------------------------------------------------------------- */

export interface QualitySample {
  level: CallQuality;
  rtt: number;
  loss: number;
  jitter: number;
}

/**
 * Reads the live transport stats and grades the link.
 *
 * Round-trip time and packet loss are the two that map to what a person
 * actually perceives — latency to "we keep talking over each other", loss to
 * "you're breaking up".
 */
export async function sampleQuality(
  peer: RTCPeerConnection,
  previous: { packetsLost: number; packetsReceived: number }
): Promise<{ sample: QualitySample; counters: { packetsLost: number; packetsReceived: number } }> {
  const stats = await peer.getStats();

  let rtt = 0;
  let jitter = 0;
  let packetsLost = 0;
  let packetsReceived = 0;

  stats.forEach((report) => {
    if (report.type === "candidate-pair" && report.state === "succeeded") {
      if (typeof report.currentRoundTripTime === "number") {
        rtt = Math.max(rtt, report.currentRoundTripTime * 1000);
      }
    }

    if (report.type === "inbound-rtp" && !report.isRemote) {
      packetsLost += report.packetsLost ?? 0;
      packetsReceived += report.packetsReceived ?? 0;
      jitter = Math.max(jitter, (report.jitter ?? 0) * 1000);
    }
  });

  // Loss is measured over the interval, not since the call began — otherwise
  // one early blip would keep the call flagged as poor forever.
  const deltaLost = Math.max(0, packetsLost - previous.packetsLost);
  const deltaReceived = Math.max(0, packetsReceived - previous.packetsReceived);
  const total = deltaLost + deltaReceived;
  const loss = total > 0 ? (deltaLost / total) * 100 : 0;

  let level: CallQuality = "good";
  if (loss > 8 || rtt > 500 || jitter > 60) level = "poor";
  else if (loss > 3 || rtt > 250 || jitter > 30) level = "fair";

  return {
    sample: { level, rtt: Math.round(rtt), loss: Number(loss.toFixed(1)), jitter: Math.round(jitter) },
    counters: { packetsLost, packetsReceived },
  };
}

/* -------------------------------------------------------------------------- */
/*                                   Helpers                                  */
/* -------------------------------------------------------------------------- */

export function stopStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop());
}

/** Human-readable reason for a getUserMedia failure. */
export function describeMediaError(error: unknown, kind: CallKind): string {
  const name = (error as { name?: string })?.name ?? "";

  switch (name) {
    case "NotAllowedError":
    case "SecurityError":
      return kind === "video"
        ? "Camera and microphone access was blocked. Allow it in your browser settings to call."
        : "Microphone access was blocked. Allow it in your browser settings to call.";
    case "NotFoundError":
    case "OverconstrainedError":
      return kind === "video"
        ? "No camera or microphone was found on this device."
        : "No microphone was found on this device.";
    case "NotReadableError":
      return "Your camera or microphone is already in use by another app.";
    default:
      return "Could not start your camera or microphone.";
  }
}

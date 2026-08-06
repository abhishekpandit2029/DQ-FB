import { Request, Response } from "express";
import { Types } from "mongoose";
import { z } from "zod";
import CallLog from "../models/CallLog";
import { ApiError } from "../utils/ApiError";
import { currentUserId } from "../middleware/auth";
import { canInteract } from "../services/relationship";
import { publicUser } from "../utils/serialize";

/**
 * ICE servers for the browser's RTCPeerConnection.
 *
 * Public STUN only. Peers behind symmetric NAT (common on mobile and corporate
 * networks) cannot form a direct connection this way and their calls will fail
 * to connect; relaying those would need a TURN server.
 */
export async function getIceServers(_req: Request, res: Response) {
  res.json({
    success: true,
    iceServers: [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }],
  });
}

const kindSchema = z.object({ kind: z.enum(["audio", "video"]) });

/** Pre-flight check so the UI can disable a call button before dialling. */
export async function checkCallPermission(req: Request, res: Response) {
  const viewerId = currentUserId(req);
  const { userId } = req.params;
  const { kind } = kindSchema.parse(req.query);

  if (!Types.ObjectId.isValid(userId)) throw ApiError.badRequest("Invalid user id");

  const permission = await canInteract(viewerId, userId, kind);
  res.json({ success: true, ...permission });
}

const historySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  page: z.coerce.number().int().min(1).default(1),
});

export async function listCallHistory(req: Request, res: Response) {
  const viewerId = currentUserId(req);
  const { limit, page } = historySchema.parse(req.query);

  const logs = await CallLog.find({
    $or: [{ caller: viewerId }, { callee: viewerId }],
  })
    .populate("caller", "username full_name userprofile_image isPrivate")
    .populate("callee", "username full_name userprofile_image isPrivate")
    .sort({ startedAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();

  res.json({
    success: true,
    calls: logs.map((log) => {
      const outgoing = String((log.caller as { _id?: unknown })?._id ?? log.caller) === viewerId;
      return {
        _id: String(log._id),
        callId: log.callId,
        kind: log.kind,
        outcome: log.outcome,
        direction: outgoing ? "outgoing" : "incoming",
        peer: publicUser((outgoing ? log.callee : log.caller) as never),
        startedAt: log.startedAt,
        durationSec: log.durationSec,
      };
    }),
  });
}

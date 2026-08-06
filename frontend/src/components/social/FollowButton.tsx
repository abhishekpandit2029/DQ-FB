"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import type { Relationship, RelationshipState } from "@/lib/types";
import Button from "@/components/ui/Button";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { CheckIcon, ClockIcon, UserPlusIcon } from "@/components/ui/icons";

export interface FollowButtonProps {
  userId: string;
  relationship: Relationship;
  onChange: (state: RelationshipState) => void;
  size?: "sm" | "md";
  fullWidth?: boolean;
}

/**
 * A follow always begins as a request the other person has to approve, so this
 * cycles Follow → Requested → Following rather than following outright.
 */
export default function FollowButton({
  userId,
  relationship,
  onChange,
  size = "sm",
  fullWidth = false,
}: FollowButtonProps) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [confirmUnfollow, setConfirmUnfollow] = useState(false);

  const act = async (
    path: string,
    nextState: RelationshipState,
    successMessage?: string
  ) => {
    setBusy(true);
    try {
      await api.post(path, { userId });
      onChange(nextState);
      if (successMessage) toast.success(successMessage);
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (relationship.outgoing === "self") return null;

  switch (relationship.outgoing) {
    case "following":
      return (
        <>
          <Button
            variant="secondary"
            size={size}
            fullWidth={fullWidth}
            loading={busy}
            leftIcon={<CheckIcon />}
            onClick={() => setConfirmUnfollow(true)}
          >
            Following
          </Button>

          <ConfirmDialog
            open={confirmUnfollow}
            onClose={() => setConfirmUnfollow(false)}
            onConfirm={() => act("/follow/unfollow", "none")}
            title="Unfollow this account?"
            description="You'll stop seeing their entries, and you'll need to request again to follow them back."
            confirmLabel="Unfollow"
            danger
          />
        </>
      );

    case "requested":
      return (
        <Button
          variant="outline"
          size={size}
          fullWidth={fullWidth}
          loading={busy}
          leftIcon={<ClockIcon />}
          onClick={() => act("/follow/cancel", "none", "Request withdrawn")}
        >
          Requested
        </Button>
      );

    case "incoming":
      // They asked to follow you first — approving is the natural action here.
      return (
        <Button
          size={size}
          fullWidth={fullWidth}
          loading={busy}
          leftIcon={<CheckIcon />}
          onClick={() => act("/follow/accept", "none", "Request accepted")}
        >
          Accept request
        </Button>
      );

    default:
      return (
        <Button
          size={size}
          fullWidth={fullWidth}
          loading={busy}
          leftIcon={<UserPlusIcon />}
          onClick={() => act("/follow/request", "requested", "Follow request sent")}
        >
          Follow
        </Button>
      );
  }
}

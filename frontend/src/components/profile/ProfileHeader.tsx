"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { formatCount, formatDate } from "@/lib/format";
import type { Profile, RelationshipState } from "@/lib/types";
import { useCall } from "@/providers/CallProvider";
import Avatar from "@/components/ui/Avatar";
import Button from "@/components/ui/Button";
import IconButton from "@/components/ui/IconButton";
import Tag from "@/components/ui/Tag";
import { useToast } from "@/components/ui/Toast";
import {
  ChatIcon,
  ClockIcon,
  GlobeIcon,
  LinkIcon,
  LocationIcon,
  LockIcon,
  PhoneIcon,
  VideoIcon,
} from "@/components/ui/icons";
import FollowButton from "@/components/social/FollowButton";
import ConnectionsModal from "./ConnectionsModal";

export interface ProfileHeaderProps {
  profile: Profile;
  isSelf: boolean;
  onRelationshipChange: (state: RelationshipState) => void;
  onEditProfile?: () => void;
  onMessage?: () => void;
}

export default function ProfileHeader({
  profile,
  isSelf,
  onRelationshipChange,
  onEditProfile,
  onMessage,
}: ProfileHeaderProps) {
  const toast = useToast();
  const call = useCall();
  const [connections, setConnections] = useState<"followers" | "following" | null>(null);
  const [startingChat, setStartingChat] = useState(false);

  const { relationship } = profile;

  const startChat = async () => {
    if (!relationship.canMessage) {
      toast.error("You can't message this person yet");
      return;
    }

    setStartingChat(true);
    try {
      await api.post("/chats", { userId: profile._id });
      onMessage?.();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setStartingChat(false);
    }
  };

  return (
    <header className="rounded-xl bg-surface p-5 ring-1 ring-line tab:p-6">
      <div className="flex flex-col items-center text-center tab:flex-row tab:items-start tab:text-left">
        <Avatar
          src={profile.userprofile_image}
          name={profile.full_name}
          username={profile.username}
          size="xl"
          // The profile photo is usually the LCP element on this route.
          priority
        />

        <div className="mt-4 min-w-0 flex-1 tab:ml-6 tab:mt-0">
          <div className="flex flex-col items-center gap-2 tab:flex-row tab:items-start tab:justify-between">
            <div className="min-w-0">
              <h1 className="flex items-center justify-center gap-2 text-xl font-bold text-content tab:justify-start">
                <span className="truncate">{profile.full_name || profile.username}</span>
                {profile.isPrivate ? (
                  <Tag tone="neutral" icon={<LockIcon className="h-3 w-3" />}>
                    Private
                  </Tag>
                ) : (
                  <Tag tone="neutral" icon={<GlobeIcon className="h-3 w-3" />}>
                    Public
                  </Tag>
                )}
              </h1>
              <p className="text-sm text-muted">@{profile.username}</p>
            </div>

            {/* Actions */}
            <div className="flex shrink-0 items-center gap-2">
              {isSelf ? (
                <Button variant="secondary" size="sm" onClick={onEditProfile}>
                  Edit profile
                </Button>
              ) : (
                <>
                  <FollowButton
                    userId={profile._id}
                    relationship={relationship}
                    onChange={onRelationshipChange}
                  />

                  {relationship.canMessage && (
                    <IconButton
                      label="Message"
                      variant="ghost"
                      onClick={startChat}
                      disabled={startingChat}
                      className="ring-1 ring-line"
                    >
                      <ChatIcon />
                    </IconButton>
                  )}

                  {relationship.canAudioCall && (
                    <IconButton
                      label="Voice call"
                      variant="ghost"
                      onClick={() => call.startCall(profile, "audio")}
                      className="ring-1 ring-line"
                    >
                      <PhoneIcon />
                    </IconButton>
                  )}

                  {relationship.canVideoCall && (
                    <IconButton
                      label="Video call"
                      variant="ghost"
                      onClick={() => call.startCall(profile, "video")}
                      className="ring-1 ring-line"
                    >
                      <VideoIcon />
                    </IconButton>
                  )}
                </>
              )}
            </div>
          </div>

          {profile.bio && (
            <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-muted">
              {profile.bio}
            </p>
          )}

          <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-xs text-muted tab:justify-start">
            {profile.location && (
              <span className="flex items-center gap-1">
                <LocationIcon className="h-3.5 w-3.5" />
                {profile.location}
              </span>
            )}
            {profile.link && (
              <a
                href={profile.link}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="flex items-center gap-1 text-brand hover:underline"
              >
                <LinkIcon className="h-3.5 w-3.5" />
                {profile.link_alias || profile.link}
              </a>
            )}
            <span className="flex items-center gap-1">
              <ClockIcon className="h-3.5 w-3.5" />
              Joined {formatDate(profile.createdAt)}
            </span>
          </div>

          <div className="mt-4 flex items-center justify-center gap-6 tab:justify-start">
            <button
              type="button"
              onClick={() => setConnections("followers")}
              className="text-sm text-muted transition-colors hover:text-content"
            >
              <strong className="tabular-nums text-content">
                {formatCount(profile.followersCount)}
              </strong>{" "}
              followers
            </button>
            <button
              type="button"
              onClick={() => setConnections("following")}
              className="text-sm text-muted transition-colors hover:text-content"
            >
              <strong className="tabular-nums text-content">
                {formatCount(profile.followingCount)}
              </strong>{" "}
              following
            </button>
          </div>
        </div>
      </div>

      {connections && (
        <ConnectionsModal
          open
          onClose={() => setConnections(null)}
          userId={profile._id}
          initialTab={connections}
          isSelf={isSelf}
        />
      )}
    </header>
  );
}

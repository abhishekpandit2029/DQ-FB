"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { CurrentUser, InteractionSettings as Settings } from "@/lib/types";
import { useMe } from "@/hooks/useMe";
import Switch from "@/components/ui/Switch";
import { useToast } from "@/components/ui/Toast";
import { ChatIcon, PhoneIcon, VideoIcon } from "@/components/ui/icons";

interface Channel {
  key: "message" | "audio" | "video";
  icon: React.ReactNode;
  title: string;
  /** The yes/no question: do you want to be reachable this way at all? */
  toggleLabel: string;
  toggleDescription: string;
  toggleField: keyof Pick<Settings, "allowMessages" | "allowAudioCalls" | "allowVideoCalls">;
}

const CHANNELS: Channel[] = [
  {
    key: "message",
    icon: <ChatIcon />,
    title: "Messages",
    toggleLabel: "Let people message you",
    toggleDescription: "Turn this off and nobody can start a conversation with you.",
    toggleField: "allowMessages",
  },
  {
    key: "audio",
    icon: <PhoneIcon />,
    title: "Voice calls",
    toggleLabel: "Let people call you",
    toggleDescription: "Turn this off and nobody can place a voice call to you.",
    toggleField: "allowAudioCalls",
  },
  {
    key: "video",
    icon: <VideoIcon />,
    title: "Video calls",
    toggleLabel: "Let people video call you",
    toggleDescription: "Turn this off and nobody can place a video call to you.",
    toggleField: "allowVideoCalls",
  },
];

/**
 * One on/off switch per channel. Reach is always limited to connections, so the
 * only question left is whether you want to be reachable that way at all.
 */
export default function InteractionSettings() {
  const toast = useToast();
  const { me, refresh } = useMe();

  const [settings, setSettings] = useState<Settings | null>(null);
  // The single field currently in flight. A shared `saving` boolean disabled
  // all six controls at once, so changing one channel visibly greyed out the
  // whole section until the request came back.
  const [pendingField, setPendingField] = useState<keyof Settings | null>(null);

  useEffect(() => {
    if (me?.interaction) setSettings(me.interaction);
  }, [me?.interaction]);

  if (!settings) return null;

  /** Applies the change locally first, then persists just that one field. */
  const update = async <K extends keyof Settings>(field: K, value: Settings[K]) => {
    const previous = settings;
    setSettings({ ...settings, [field]: value });
    setPendingField(field);

    try {
      // The PATCH already responds with the full updated user, so seed the SWR
      // cache from it rather than firing a second /users/me round-trip.
      const response = await api.patch<{ data: CurrentUser }>("/users/me/interaction", {
        [field]: value,
      });
      await refresh(response, { revalidate: false });
    } catch (error) {
      setSettings(previous);
      toast.error((error as Error).message);
    } finally {
      setPendingField(null);
    }
  };

  return (
    <section className="rounded-xl bg-surface ring-1 ring-line">
      <header className="border-b border-line px-5 py-4">
        <h2 className="text-sm font-semibold text-content">Who can reach you</h2>
        <p className="mt-1 text-xs text-muted">
          Only your connections can reach you — people you follow, or who follow you,
          with an accepted request.
        </p>
      </header>

      <div className="divide-y divide-line">
        {CHANNELS.map((channel) => {
          const enabled = settings[channel.toggleField];

          return (
            <div key={channel.key} className="px-5 py-5">
              <div className="mb-3 flex items-center gap-2 text-sm font-medium text-content">
                <span className="text-muted">{channel.icon}</span>
                {channel.title}
              </div>

              <Switch
                checked={enabled}
                disabled={pendingField === channel.toggleField}
                onChange={(value) => update(channel.toggleField, value)}
                label={channel.toggleLabel}
                description={channel.toggleDescription}
              />
            </div>
          );
        })}
      </div>
    </section>
  );
}

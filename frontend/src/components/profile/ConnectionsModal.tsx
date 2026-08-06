"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { PublicUser } from "@/lib/types";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import Modal from "@/components/ui/Modal";
import { UserRowSkeleton } from "@/components/ui/Skeleton";
import Tabs from "@/components/ui/Tabs";
import { useToast } from "@/components/ui/Toast";
import { UsersIcon } from "@/components/ui/icons";
import UserRow from "@/components/social/UserRow";

type Tab = "followers" | "following";

export interface ConnectionsModalProps {
  open: boolean;
  onClose: () => void;
  userId: string;
  initialTab: Tab;
  /** Own profile gets a "Remove" action on each follower. */
  isSelf: boolean;
}

export default function ConnectionsModal({
  open,
  onClose,
  userId,
  initialTab,
  isSelf,
}: ConnectionsModalProps) {
  const toast = useToast();
  const [tab, setTab] = useState<Tab>(initialTab);
  const [users, setUsers] = useState<PublicUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const result = await api.get<{ users: PublicUser[] }>(
          `/follow/${tab}/${userId}?limit=50`
        );
        if (!cancelled) setUsers(result.users);
      } catch (error) {
        if (!cancelled) {
          setUsers([]);
          toast.error((error as Error).message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [tab, userId, toast]);

  const removeFollower = async (followerId: string) => {
    try {
      await api.post("/follow/remove-follower", { userId: followerId });
      setUsers((current) => current.filter((user) => user._id !== followerId));
      toast.success("Follower removed");
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Connections" size="md">
      <Tabs
        className="-mt-2 mb-2"
        value={tab}
        onChange={setTab}
        items={[
          { value: "followers", label: "Followers" },
          { value: "following", label: "Following" },
        ]}
      />

      {loading ? (
        <>
          <UserRowSkeleton />
          <UserRowSkeleton />
          <UserRowSkeleton />
        </>
      ) : users.length === 0 ? (
        <EmptyState
          icon={<UsersIcon />}
          title={tab === "followers" ? "No followers yet" : "Not following anyone yet"}
          description={
            tab === "followers"
              ? "Accepted follow requests will show up here."
              : "Accepted requests you've sent will show up here."
          }
        />
      ) : (
        <ul className="divide-y divide-line">
          {users.map((user) => (
            <li key={user._id}>
              <UserRow
                user={user}
                action={
                  isSelf && tab === "followers" ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => removeFollower(user._id)}
                    >
                      Remove
                    </Button>
                  ) : undefined
                }
              />
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}

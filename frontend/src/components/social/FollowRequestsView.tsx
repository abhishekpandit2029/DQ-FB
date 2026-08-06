"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { api } from "@/lib/api";
import { timeAgo } from "@/lib/format";
import type { FollowRequest } from "@/lib/types";
import { useMe } from "@/hooks/useMe";
import { useSocket } from "@/providers/SocketProvider";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import { UserRowSkeleton } from "@/components/ui/Skeleton";
import Tabs from "@/components/ui/Tabs";
import { useToast } from "@/components/ui/Toast";
import { UserPlusIcon } from "@/components/ui/icons";
import UserRow from "./UserRow";

type Tab = "incoming" | "outgoing";

interface RequestsResponse {
  requests: FollowRequest[];
  total?: number;
}

/**
 * Where follow requests are approved. Nobody appears in a follower list until
 * they've been accepted here, so this is the gate for the whole follow model.
 */
export default function FollowRequestsView() {
  const toast = useToast();
  const { socket } = useSocket();
  const { refresh: refreshMe } = useMe();

  const [tab, setTab] = useState<Tab>("incoming");
  const [busyId, setBusyId] = useState<string | null>(null);

  const incoming = useSWR<RequestsResponse>("/follow/requests/incoming?limit=50");
  const outgoing = useSWR<RequestsResponse>("/follow/requests/outgoing?limit=50");

  const active = tab === "incoming" ? incoming : outgoing;

  // A request that arrives while this page is open should just appear.
  useEffect(() => {
    const onNewRequest = () => {
      void incoming.mutate();
      void refreshMe();
    };
    const onCancelled = () => void incoming.mutate();

    socket.on("follow:request", onNewRequest);
    socket.on("follow:request-cancelled", onCancelled);

    return () => {
      socket.off("follow:request", onNewRequest);
      socket.off("follow:request-cancelled", onCancelled);
    };
  }, [socket, incoming, refreshMe]);

  const respond = async (
    request: FollowRequest,
    action: "accept" | "reject" | "cancel"
  ) => {
    setBusyId(request.requestId);
    try {
      await api.post(`/follow/${action}`, {
        ...(action === "cancel"
          ? { userId: request.user._id }
          : { requestId: request.requestId }),
      });

      await Promise.all([incoming.mutate(), outgoing.mutate(), refreshMe()]);

      toast.success(
        action === "accept"
          ? `${request.user.username} now follows you`
          : action === "reject"
            ? "Request declined"
            : "Request withdrawn"
      );
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  const requests = active.data?.requests ?? [];

  return (
    <div className="px-4 pt-5 lap:px-0 lap:pt-0">
      <PageHeader
        title="Requests"
        description="Approve who gets to follow you, message you and call you."
      />

      <Tabs
        className="mb-2"
        value={tab}
        onChange={setTab}
        items={[
          { value: "incoming", label: "Received", count: incoming.data?.requests.length },
          { value: "outgoing", label: "Sent", count: outgoing.data?.requests.length },
        ]}
      />

      {active.isLoading ? (
        <>
          <UserRowSkeleton />
          <UserRowSkeleton />
          <UserRowSkeleton />
        </>
      ) : requests.length === 0 ? (
        <EmptyState
          illustrated
          icon={<UserPlusIcon />}
          title={tab === "incoming" ? "No pending requests" : "No requests sent"}
          description={
            tab === "incoming"
              ? "When someone asks to follow you, they'll show up here for you to approve."
              : "Requests you've sent that are still waiting for approval will show up here."
          }
        />
      ) : (
        <ul className="divide-y divide-line">
          {requests.map((request) => (
            <li key={request.requestId}>
              <UserRow
                user={request.user}
                subtitle={`@${request.user.username} · ${timeAgo(request.createdAt)}`}
                action={
                  tab === "incoming" ? (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        loading={busyId === request.requestId}
                        onClick={() => respond(request, "accept")}
                      >
                        Accept
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={busyId === request.requestId}
                        onClick={() => respond(request, "reject")}
                      >
                        Decline
                      </Button>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      loading={busyId === request.requestId}
                      onClick={() => respond(request, "cancel")}
                    >
                      Withdraw
                    </Button>
                  )
                }
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

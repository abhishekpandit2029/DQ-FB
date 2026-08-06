"use client";

import { useState } from "react";
import useSWR from "swr";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import type { RelationshipState, UserSummary } from "@/lib/types";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { UserRowSkeleton } from "@/components/ui/Skeleton";
import { SearchIcon } from "@/components/ui/icons";
import UserRow from "@/components/social/UserRow";

interface UsersResponse {
  users: UserSummary[];
}

export interface DiscoverPanelProps {
  /** Drops the card chrome — used inside drawers and sheets. */
  compact?: boolean;
  /**
   * When provided, each row offers "Message" instead of a follow button and
   * calls back with the chosen user. Rows the viewer can't message are
   * disabled rather than hidden, so the reason stays visible.
   */
  onSelectUser?: (user: UserSummary) => void;
}

/** People search with follow suggestions. */
export default function DiscoverPanel({ compact = false, onSelectUser }: DiscoverPanelProps) {
  const [query, setQuery] = useState("");
  // Debounced so typing doesn't fire a request per keystroke.
  const debouncedQuery = useDebouncedValue(query, 300);

  const { data, isLoading, mutate } = useSWR<UsersResponse>(
    `/users?limit=10${debouncedQuery ? `&searchQuery=${encodeURIComponent(debouncedQuery)}` : ""}`
  );

  const users = data?.users ?? [];

  const patchRelationship = (userId: string, outgoing: RelationshipState) => {
    void mutate(
      (current) =>
        current
          ? {
              ...current,
              users: current.users.map((user) =>
                user._id === userId
                  ? { ...user, relationship: { ...user.relationship, outgoing } }
                  : user
              ),
            }
          : current,
      { revalidate: false }
    );
  };

  return (
    <section className={compact ? "" : "sticky top-6 rounded-xl bg-surface p-4 ring-1 ring-line"}>
      {!compact && <h2 className="mb-3 text-sm font-semibold text-content">Find people</h2>}

      <Input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search by name or username"
        leftIcon={<SearchIcon />}
        aria-label="Search people"
      />

      <div className="mt-2">
        {isLoading ? (
          <>
            <UserRowSkeleton />
            <UserRowSkeleton />
            <UserRowSkeleton />
          </>
        ) : users.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">
            {debouncedQuery ? "No one matched that search." : "No suggestions right now."}
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {users.map((user) => (
              <li key={user._id}>
                <UserRow
                  user={user}
                  relationship={onSelectUser ? undefined : user.relationship}
                  onRelationshipChange={
                    onSelectUser ? undefined : (state) => patchRelationship(user._id, state)
                  }
                  action={
                    onSelectUser ? (
                      <Button
                        size="sm"
                        variant={user.relationship.canMessage ? "primary" : "secondary"}
                        disabled={!user.relationship.canMessage}
                        title={
                          user.relationship.canMessage
                            ? undefined
                            : "You need to be connected to message this person"
                        }
                        onClick={() => onSelectUser(user)}
                      >
                        Message
                      </Button>
                    ) : undefined
                  }
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

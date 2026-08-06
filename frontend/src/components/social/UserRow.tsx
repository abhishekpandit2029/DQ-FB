"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import type { PublicUser, Relationship, RelationshipState } from "@/lib/types";
import Avatar from "@/components/ui/Avatar";
import Tag from "@/components/ui/Tag";
import { LockIcon } from "@/components/ui/icons";
import FollowButton from "./FollowButton";

export interface UserRowProps {
  user: PublicUser;
  relationship?: Relationship;
  onRelationshipChange?: (state: RelationshipState) => void;
  /** Replaces the follow button — used by the requests list. */
  action?: ReactNode;
  online?: boolean;
  subtitle?: string;
}

export default function UserRow({
  user,
  relationship,
  onRelationshipChange,
  action,
  online,
  subtitle,
}: UserRowProps) {
  return (
    <div className="flex items-center gap-3 py-3">
      <Link href={`/dashboard/u/${user.username}`} className="shrink-0">
        <Avatar
          src={user.userprofile_image}
          name={user.full_name}
          username={user.username}
          size="md"
          online={online}
        />
      </Link>

      <div className="min-w-0 flex-1">
        <Link
          href={`/dashboard/u/${user.username}`}
          className="flex items-center gap-1.5 truncate text-sm font-semibold text-content hover:underline"
        >
          <span className="truncate">{user.full_name || user.username}</span>
          {user.isPrivate && (
            <Tag tone="neutral" className="shrink-0 px-1.5">
              <LockIcon className="h-3 w-3" />
            </Tag>
          )}
        </Link>
        <p className="truncate text-xs text-muted">{subtitle ?? `@${user.username}`}</p>
      </div>

      <div className="shrink-0">
        {action ??
          (relationship && onRelationshipChange ? (
            <FollowButton
              userId={user._id}
              relationship={relationship}
              onChange={onRelationshipChange}
            />
          ) : null)}
      </div>
    </div>
  );
}

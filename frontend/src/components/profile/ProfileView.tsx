"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import useSWR from "swr";
import { useMe } from "@/hooks/useMe";
import { usePostList } from "@/hooks/usePostList";
import type { Post, Profile, RelationshipState } from "@/lib/types";
import ComposeEntryModal from "@/components/post/ComposeEntryModal";
import PostCard from "@/components/post/PostCard";
import EditProfileModal from "@/components/profile/EditProfileModal";
import EmptyState from "@/components/ui/EmptyState";
import Skeleton, { PostCardSkeleton } from "@/components/ui/Skeleton";
import { FeedIcon, LockIcon } from "@/components/ui/icons";
import ProfileHeader from "./ProfileHeader";

export interface ProfileViewProps {
  /** Omit for the signed-in user's own profile. */
  username?: string;
}

export default function ProfileView({ username }: ProfileViewProps) {
  const router = useRouter();
  const { me } = useMe();

  /**
   * Your own profile resolves by id — it's already in hand from `/users/me`,
   * so there's no reason to make the server look you up by name. A visited
   * profile still comes in as a username from the URL.
   */
  const identifier = username ?? me?._id;
  const {
    data,
    isLoading: profileLoading,
    mutate: mutateProfile,
  } = useSWR<{ data: Profile }>(identifier ? `/users/${identifier}` : null);

  const profile = data?.data;
  const isSelf = Boolean(profile && me && profile._id === me._id);

  // Own entries come from /posts/mine so drafts in the bin stay excluded but
  // ownership actions are available; others go through the visibility check.
  const postsKey = profile
    ? isSelf
      ? "/posts/mine?limit=20"
      : profile.relationship.canViewPosts
        ? `/posts/user/${profile._id}?limit=20`
        : null
    : null;

  const { posts, isLoading: postsLoading, patch, remove, refresh } = usePostList(postsKey);

  const [editingProfile, setEditingProfile] = useState(false);
  const [editingPost, setEditingPost] = useState<Post | null>(null);

  const onRelationshipChange = (outgoing: RelationshipState) => {
    void mutateProfile(
      (current) =>
        current
          ? {
              data: {
                ...current.data,
                relationship: { ...current.data.relationship, outgoing },
              },
            }
          : current,
      { revalidate: true }
    );
  };

  if (profileLoading || !profile) {
    return (
      <div className="space-y-3 px-4 pt-5 lap:px-0 lap:pt-0">
        <Skeleton className="h-52 w-full" rounded="lg" />
        <PostCardSkeleton />
        <PostCardSkeleton />
      </div>
    );
  }

  return (
    <div className="px-4 pt-5 lap:px-0 lap:pt-0">
      <ProfileHeader
        profile={profile}
        isSelf={isSelf}
        onRelationshipChange={onRelationshipChange}
        onEditProfile={() => setEditingProfile(true)}
        onMessage={() => router.push(`/dashboard/inbox?user=${profile._id}`)}
      />

      <div className="mt-5 space-y-3">
        {!profile.relationship.canViewPosts ? (
          <EmptyState
            icon={<LockIcon />}
            title="This account is private"
            description="Follow this account to see their diary entries. They'll need to approve your request first."
          />
        ) : postsLoading ? (
          <>
            <PostCardSkeleton />
            <PostCardSkeleton />
          </>
        ) : posts.length === 0 ? (
          <EmptyState
            illustrated
            icon={<FeedIcon />}
            title={isSelf ? "You haven't written anything yet" : "No entries yet"}
            description={
              isSelf
                ? "Your first entry is one tap away — use the New entry button."
                : "When they write something, it'll appear here."
            }
          />
        ) : (
          posts.map((post) => (
            <PostCard
              key={post._id}
              post={post}
              isOwner={isSelf}
              onChange={patch}
              onDelete={remove}
              onEdit={setEditingPost}
            />
          ))
        )}
      </div>

      {editingProfile && (
        <EditProfileModal open onClose={() => setEditingProfile(false)} />
      )}

      {editingPost && (
        <ComposeEntryModal
          open
          post={editingPost}
          onClose={() => setEditingPost(null)}
          onSaved={() => {
            setEditingPost(null);
            void refresh();
          }}
        />
      )}
    </div>
  );
}

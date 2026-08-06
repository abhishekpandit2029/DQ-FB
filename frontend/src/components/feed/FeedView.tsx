"use client";

import { useState } from "react";
import { usePostList } from "@/hooks/usePostList";
import { useMe } from "@/hooks/useMe";
import type { Post } from "@/lib/types";
import PageHeader from "@/components/layout/PageHeader";
import PostCard from "@/components/post/PostCard";
import ComposeEntryModal from "@/components/post/ComposeEntryModal";
import EmptyState from "@/components/ui/EmptyState";
import Tabs from "@/components/ui/Tabs";
import { PostCardSkeleton } from "@/components/ui/Skeleton";
import { FeedIcon } from "@/components/ui/icons";
import DiscoverPanel from "./DiscoverPanel";

type FeedTab = "following" | "explore";

export default function FeedView() {
  const { me } = useMe();
  const [tab, setTab] = useState<FeedTab>("following");
  const [editing, setEditing] = useState<Post | null>(null);

  const key = tab === "following" ? "/posts/feed?limit=20" : "/posts/explore?limit=20";
  const { posts, isLoading, patch, remove, refresh } = usePostList(key);

  return (
    <div className="lap:grid lap:grid-cols-[minmax(0,1fr)_20rem] lap:gap-6">
      <div className="min-w-0">
        <PageHeader
          title="Moments"
          description="Entries from you and the people you follow."
        />

        <Tabs
          className="mb-4 px-4 lap:px-0"
          value={tab}
          onChange={setTab}
          items={[
            { value: "following", label: "Following" },
            { value: "explore", label: "Discover" },
          ]}
        />

        <div className="space-y-3 px-4 lap:px-0">
          {isLoading ? (
            // Three skeletons match the typical above-the-fold count, so the
            // real cards drop straight in without pushing anything around.
            <>
              <PostCardSkeleton />
              <PostCardSkeleton />
              <PostCardSkeleton />
            </>
          ) : posts.length === 0 ? (
            <EmptyState
              illustrated
              icon={<FeedIcon />}
              title={
                tab === "following"
                  ? "Nothing here yet"
                  : "No public entries to discover"
              }
              description={
                tab === "following"
                  ? "Write your first entry, or follow someone to see theirs here."
                  : "Check back once more people have shared something."
              }
            />
          ) : (
            posts.map((post) => (
              <PostCard
                key={post._id}
                post={post}
                isOwner={post.author._id === me?._id}
                onChange={patch}
                onDelete={remove}
                onEdit={setEditing}
              />
            ))
          )}
        </div>
      </div>

      {/* Discovery rail — desktop only, so it costs mobile nothing. */}
      <aside className="hidden lap:block">
        <DiscoverPanel />
      </aside>

      {editing && (
        <ComposeEntryModal
          open
          post={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void refresh();
          }}
        />
      )}
    </div>
  );
}

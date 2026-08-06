"use client";

import { usePostList } from "@/hooks/usePostList";
import PageHeader from "@/components/layout/PageHeader";
import PostCard from "@/components/post/PostCard";
import EmptyState from "@/components/ui/EmptyState";
import { PostCardSkeleton } from "@/components/ui/Skeleton";
import { TrashIcon } from "@/components/ui/icons";

/** Soft-deleted entries, where they can be restored or removed for good. */
export default function BinView() {
  const { posts, isLoading, remove, refresh } = usePostList("/posts/mine?bin=true&limit=20");

  return (
    <div className="px-4 pt-5 lap:px-0 lap:pt-0">
      <PageHeader
        title="Recycle"
        description="Entries you've removed. Restore them, or delete them for good."
      />

      <div className="space-y-3">
        {isLoading ? (
          <>
            <PostCardSkeleton />
            <PostCardSkeleton />
          </>
        ) : posts.length === 0 ? (
          <EmptyState
            illustrated
            icon={<TrashIcon />}
            title="Nothing in here"
            description="Entries you remove will wait here until you delete them permanently."
          />
        ) : (
          posts.map((post) => (
            <PostCard
              key={post._id}
              post={post}
              variant="bin"
              isOwner
              onDelete={remove}
              onRestore={() => {
                remove(post._id);
                void refresh();
              }}
            />
          ))
        )}
      </div>
    </div>
  );
}

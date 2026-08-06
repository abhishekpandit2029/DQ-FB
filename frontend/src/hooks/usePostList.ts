"use client";

import { useCallback } from "react";
import useSWR from "swr";
import { swrFetcher } from "@/lib/api";
import type { Post } from "@/lib/types";

interface PostListResponse {
  posts: Post[];
}

/**
 * Shared list state for every screen that renders posts.
 *
 * The patch/remove helpers write straight into the SWR cache so a like or a
 * delete updates in place, with no refetch and no scroll jump.
 */
export function usePostList(key: string | null) {
  const { data, error, isLoading, mutate } = useSWR<PostListResponse>(key, swrFetcher);

  const patch = useCallback(
    (updated: Post) => {
      void mutate(
        (current) =>
          current
            ? {
                ...current,
                posts: current.posts.map((post) =>
                  post._id === updated._id ? updated : post
                ),
              }
            : current,
        { revalidate: false }
      );
    },
    [mutate]
  );

  const remove = useCallback(
    (postId: string) => {
      void mutate(
        (current) =>
          current
            ? { ...current, posts: current.posts.filter((post) => post._id !== postId) }
            : current,
        { revalidate: false }
      );
    },
    [mutate]
  );

  const prepend = useCallback(
    (post: Post) => {
      void mutate(
        (current) => (current ? { ...current, posts: [post, ...current.posts] } : current),
        { revalidate: false }
      );
    },
    [mutate]
  );

  return {
    posts: data?.posts ?? [],
    isLoading,
    error,
    patch,
    remove,
    prepend,
    refresh: mutate,
  };
}

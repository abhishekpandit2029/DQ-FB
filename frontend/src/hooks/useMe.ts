"use client";

import useSWR from "swr";
import { swrFetcher } from "@/lib/api";
import type { CurrentUser } from "@/lib/types";

interface MeResponse {
  data: CurrentUser;
}

/**
 * The signed-in user. Shared through SWR's cache, so every component that calls
 * this reads the same record and one revalidation updates them all.
 */
export function useMe() {
  const { data, error, isLoading, mutate } = useSWR<MeResponse>(
    "/users/me",
    swrFetcher,
    {
      revalidateOnFocus: false,
      shouldRetryOnError: false,
    }
  );

  return {
    me: data?.data,
    isLoading,
    error,
    refresh: mutate,
  };
}

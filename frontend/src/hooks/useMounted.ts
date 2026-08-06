"use client";

import { useEffect, useState } from "react";

/** True only after hydration — gates portals so SSR and client markup match. */
export function useMounted() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}

"use client";

import { useEffect, useState } from "react";

/**
 * Delays a rapidly changing value — used on search inputs so typing doesn't
 * fire a request per keystroke, which keeps the main thread free (INP).
 */
export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}

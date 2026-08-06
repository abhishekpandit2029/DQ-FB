"use client";

import { useLayoutEffect } from "react";

let lockCount = 0;
let restoreStyles: (() => void) | null = null;

/**
 * Freezes background scrolling while an overlay is open.
 *
 * The scrollbar's width is added back as padding so the page doesn't shift
 * sideways when it disappears — that jump is a CLS hit on desktop. Nested
 * overlays share one lock via the counter.
 */
export function useLockBodyScroll(active: boolean) {
  useLayoutEffect(() => {
    if (!active) return;

    lockCount += 1;

    if (lockCount === 1) {
      const { body } = document;
      const previousOverflow = body.style.overflow;
      const previousPaddingRight = body.style.paddingRight;
      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

      body.style.overflow = "hidden";
      if (scrollbarWidth > 0) body.style.paddingRight = `${scrollbarWidth}px`;

      restoreStyles = () => {
        body.style.overflow = previousOverflow;
        body.style.paddingRight = previousPaddingRight;
      };
    }

    return () => {
      lockCount -= 1;
      if (lockCount === 0) {
        restoreStyles?.();
        restoreStyles = null;
      }
    };
  }, [active]);
}

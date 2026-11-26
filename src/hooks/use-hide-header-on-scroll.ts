"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Hides a sticky header on compact viewports while scrolling down and reveals
 * it on the first upward movement. Desktop keeps the header in place. rAF
 * throttling and a small hysteresis keep it smooth without flickering on
 * trackpads or touch momentum.
 */
export function useHideHeaderOnScroll(pinned = false) {
  const [hidden, setHidden] = useState(false);
  const [mobile, setMobile] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches,
  );
  const lastY = useRef(0);
  const frame = useRef<number | null>(null);
  const reveal = useCallback(() => setHidden(false), []);

  useEffect(() => {
    const query = window.matchMedia("(max-width: 767px)");
    const onMediaChange = (event: MediaQueryListEvent) => {
      setMobile(event.matches);
      setHidden(false);
      lastY.current = window.scrollY;
    };

    query.addEventListener("change", onMediaChange);
    return () => query.removeEventListener("change", onMediaChange);
  }, []);

  useEffect(() => {
    if (pinned || !mobile) return;

    lastY.current = window.scrollY;
    const onScroll = () => {
      if (frame.current !== null) return;
      frame.current = requestAnimationFrame(() => {
        frame.current = null;
        const y = Math.max(0, window.scrollY);
        const delta = y - lastY.current;

        if (y <= 80) setHidden(false);
        else if (delta > 6) setHidden(true);
        else if (delta < -6) setHidden(false);

        lastY.current = y;
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
  }, [pinned, mobile]);

  return { hidden: pinned || !mobile ? false : hidden, reveal };
}

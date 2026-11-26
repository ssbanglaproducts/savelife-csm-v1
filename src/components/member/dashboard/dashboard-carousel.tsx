"use client";

import {
  Children,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";

const desktopGrids = {
  // Each slide already groups four cards, so desktop shows one group per row.
  four: "md:grid-cols-1",
  analytics: "md:grid-cols-2 xl:grid-cols-3",
  progress: "md:grid-cols-2 xl:grid-cols-3",
} as const;

const desktopQuery = "(min-width: 768px)";

/** Mobile swipe sections with title-adjacent dots; desktop shows every slide. */
export function DashboardCarousel({
  title,
  children,
  desktopColumns = "four",
}: {
  title: string;
  children: ReactNode;
  desktopColumns?: keyof typeof desktopGrids;
}) {
  const headingId = useId();
  const trackRef = useRef<HTMLDivElement>(null);
  const slides = Children.toArray(children);
  const [active, setActive] = useState(0);
  const [trackHeight, setTrackHeight] = useState<number | null>(null);

  const onScroll = useCallback(() => {
    const track = trackRef.current;
    if (!track || track.clientWidth === 0) return;
    const index = Math.round(track.scrollLeft / track.clientWidth);
    setActive(Math.min(slides.length - 1, Math.max(0, index)));
  }, [slides.length]);

  // On mobile the track keeps the tallest slide as its height, while every
  // slide stretches to fill it. Short cards no longer leave an empty block.
  useEffect(() => {
    const measure = () => {
      const track = trackRef.current;
      if (!track || window.matchMedia(desktopQuery).matches) {
        setTrackHeight(null);
        return;
      }

      const slides = Array.from(track.children);
      if (slides.length === 0) return;
      const bottomPadding = Number.parseFloat(getComputedStyle(track).paddingBottom) || 0;
      const tallestSlide = slides.reduce((tallest, slide) => {
        if (!(slide instanceof HTMLElement)) return tallest;
        return Math.max(tallest, slide.getBoundingClientRect().height, slide.scrollHeight);
      }, 0);
      setTrackHeight(Math.ceil(tallestSlide + bottomPadding));
    };

    measure();
    const media = window.matchMedia(desktopQuery);
    const observer =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);

    media.addEventListener("change", measure);
    window.addEventListener("resize", measure);
    if (observer && trackRef.current) {
      for (const slide of Array.from(trackRef.current.children)) observer.observe(slide);
    }

    return () => {
      media.removeEventListener("change", measure);
      window.removeEventListener("resize", measure);
      observer?.disconnect();
    };
  }, [slides.length]);

  return (
    <section aria-labelledby={headingId} className="min-w-0 space-y-4">
      <div className="flex min-w-0 items-center gap-3">
        <h2 id={headingId} className="font-display text-xl font-bold tracking-tight sm:text-2xl">
          {title}
        </h2>
        <div className="ml-auto flex items-center gap-1.5 md:hidden" aria-hidden="true">
          {slides.map((slide, index) => (
            <span
              key={index}
              className={cn(
                "h-1.5 rounded-full bg-border transition-all",
                index === active ? "w-4 bg-primary" : "w-1.5",
              )}
            />
          ))}
        </div>
      </div>

      <div
        ref={trackRef}
        onScroll={onScroll}
        tabIndex={0}
        style={trackHeight !== null ? { height: trackHeight } : undefined}
        className={cn(
          "flex snap-x snap-mandatory items-stretch scroll-smooth gap-4 overflow-x-auto overflow-y-hidden rounded-2xl pb-2 transition-[height] duration-300 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          "md:grid md:items-stretch md:overflow-visible md:pb-0 md:transition-none md:focus-visible:ring-0",
          desktopGrids[desktopColumns],
        )}
      >
        {slides.map((slide, index) => (
          <div key={index} className="h-full w-full min-w-full snap-center md:w-auto md:min-w-0">
            {slide}
          </div>
        ))}
      </div>
    </section>
  );
}

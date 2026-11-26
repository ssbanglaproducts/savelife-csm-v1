"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

export type HeroSlide = {
  src: string;
  alt: string;
  href?: string;
};

export function HeroCarousel({ slides, label }: { slides: HeroSlide[]; label: string }) {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const count = slides.length;

  useEffect(() => {
    if (paused || count < 2) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;
    const timer = window.setInterval(() => {
      setActive((current) => (current + 1) % count);
    }, 5200);
    return () => window.clearInterval(timer);
  }, [paused, count]);

  if (count === 0) return null;

  function goTo(index: number) {
    setActive((index + count) % count);
  }

  return (
    <section
      aria-label={label}
      aria-roledescription="carousel"
      className="relative overflow-hidden rounded-[28px] border border-border bg-muted shadow-[0_30px_80px_-45px_rgba(0,0,0,0.65)]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node)) setPaused(false);
      }}
      onTouchStart={(event) => {
        touchStartX.current = event.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={(event) => {
        const start = touchStartX.current;
        touchStartX.current = null;
        if (start === null) return;
        const delta = (event.changedTouches[0]?.clientX ?? start) - start;
        if (Math.abs(delta) < 40) return;
        goTo(active + (delta < 0 ? 1 : -1));
      }}
    >
      <div className="relative aspect-[16/9] w-full sm:aspect-[21/8]">
        {slides.map((slide, index) => (
          <div
            key={slide.src}
            aria-hidden={index !== active}
            className={cn(
              "absolute inset-0 transition-opacity duration-700 ease-out motion-reduce:transition-none",
              index === active ? "opacity-100" : "pointer-events-none opacity-0",
            )}
          >
            {slide.href ? (
              <Link href={slide.href} tabIndex={index === active ? 0 : -1} className="absolute inset-0 block">
                <Image
                  src={slide.src}
                  alt={slide.alt}
                  fill
                  loading={index === 0 ? "eager" : "lazy"}
                  fetchPriority={index === 0 ? "high" : "auto"}
                  unoptimized
                  sizes="(max-width: 768px) 100vw, 1200px"
                  className="object-cover"
                />
              </Link>
            ) : (
              <Image
                src={slide.src}
                alt={slide.alt}
                fill
                loading={index === 0 ? "eager" : "lazy"}
                fetchPriority={index === 0 ? "high" : "auto"}
                unoptimized
                sizes="(max-width: 768px) 100vw, 1200px"
                className="object-cover"
              />
            )}
          </div>
        ))}
      </div>

      {count > 1 ? (
        <>
          <button
            type="button"
            onClick={() => goTo(active - 1)}
            aria-label="Previous slide"
            className="absolute left-3 top-1/2 hidden size-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/35 text-white backdrop-blur-sm transition hover:bg-black/55 focus-visible:ring-2 focus-visible:ring-white sm:flex"
          >
            <ChevronLeft className="size-5" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => goTo(active + 1)}
            aria-label="Next slide"
            className="absolute right-3 top-1/2 hidden size-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/35 text-white backdrop-blur-sm transition hover:bg-black/55 focus-visible:ring-2 focus-visible:ring-white sm:flex"
          >
            <ChevronRight className="size-5" aria-hidden="true" />
          </button>
          <div className="absolute inset-x-0 bottom-3 flex items-center justify-center gap-2">
            {slides.map((slide, index) => (
              <button
                key={slide.src}
                type="button"
                onClick={() => goTo(index)}
                aria-label={`Slide ${index + 1}`}
                aria-current={index === active ? "true" : undefined}
                className={cn(
                  "h-2 rounded-full transition-all focus-visible:ring-2 focus-visible:ring-white",
                  index === active ? "w-7 bg-white" : "w-2 bg-white/55 hover:bg-white/80",
                )}
              />
            ))}
          </div>
        </>
      ) : null}
    </section>
  );
}

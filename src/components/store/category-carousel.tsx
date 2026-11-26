"use client";

import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type MouseEvent, type PointerEvent } from "react";
import { Boxes, ChevronLeft, ChevronRight } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

type CategoryItem = {
  slug: string;
  name: string;
  nameBn: string | null;
};

const delays = ["delay-1", "delay-2", "delay-3"];

export function CategoryCarousel({ categories }: { categories: CategoryItem[] }) {
  const t = useTranslations("store");
  const tc = useTranslations("common");
  const locale = useLocale();
  const trackRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startX: number; scrollLeft: number; active: boolean } | null>(null);
  const suppressClickRef = useRef(false);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(true);

  const updateControls = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    setCanPrev(track.scrollLeft > 2);
    setCanNext(track.scrollLeft + track.clientWidth < track.scrollWidth - 2);
  }, []);

  useEffect(() => {
    updateControls();
    window.addEventListener("resize", updateControls);
    return () => window.removeEventListener("resize", updateControls);
  }, [updateControls, categories.length]);

  function scrollByPage(direction: -1 | 1) {
    const track = trackRef.current;
    if (!track) return;
    track.scrollBy({ left: direction * track.clientWidth * 0.8, behavior: "smooth" });
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      scrollByPage(-1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      scrollByPage(1);
    }
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    // Touch devices get native horizontal scrolling; mouse/pen get drag-to-swipe.
    if (event.pointerType === "touch" || event.button !== 0) return;
    dragRef.current = {
      startX: event.clientX,
      scrollLeft: event.currentTarget.scrollLeft,
      active: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag) return;
    const delta = event.clientX - drag.startX;
    if (Math.abs(delta) > 4) drag.active = true;
    if (drag.active) event.currentTarget.scrollLeft = drag.scrollLeft - delta;
  }

  function onPointerUp(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (drag?.active) {
      suppressClickRef.current = true;
      window.setTimeout(() => {
        suppressClickRef.current = false;
      }, 0);
    }
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function onClickCapture(event: MouseEvent<HTMLDivElement>) {
    if (!suppressClickRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    suppressClickRef.current = false;
  }

  return (
    <section id="categories" aria-labelledby="categories-heading" className="border-b border-border bg-[var(--glass)]">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 id="categories-heading" className="font-display text-3xl tracking-tight sm:text-4xl">
              {t("categoriesTitle")}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">{t("categoriesHint")}</p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/products"
              className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
            >
              {t("browseCatalogue")}
              <ChevronRight className="size-3.5" aria-hidden="true" />
            </Link>
            <div className="hidden items-center gap-1 sm:flex">
              <button
                type="button"
                onClick={() => scrollByPage(-1)}
                disabled={!canPrev}
                aria-label={tc("previous")}
                className="inline-flex size-9 items-center justify-center rounded-full border border-border bg-background/70 text-foreground transition-colors hover:border-primary/50 hover:text-primary disabled:pointer-events-none disabled:opacity-40"
              >
                <ChevronLeft className="size-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => scrollByPage(1)}
                disabled={!canNext}
                aria-label={tc("next")}
                className="inline-flex size-9 items-center justify-center rounded-full border border-border bg-background/70 text-foreground transition-colors hover:border-primary/50 hover:text-primary disabled:pointer-events-none disabled:opacity-40"
              >
                <ChevronRight className="size-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>

        <div
          ref={trackRef}
          onScroll={updateControls}
          onKeyDown={onKeyDown}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onClickCapture={onClickCapture}
          tabIndex={0}
          aria-label={t("categoriesTitle")}
          className="mt-8 flex snap-x snap-mandatory gap-3 overflow-x-auto rounded-2xl pb-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {categories.map((category, index) => {
            const name = locale === "bn" && category.nameBn ? category.nameBn : category.name;
            return (
              <Link
                key={category.slug}
                href={`/products?category=${category.slug}`}
                draggable={false}
                className={cn(
                  "glass glass-hover flex w-[calc(50%-0.375rem)] shrink-0 snap-start animate-rise items-center gap-3 rounded-2xl p-3 sm:w-[calc(33.333%-0.5rem)] lg:w-[calc(25%-0.5625rem)] xl:w-[calc(20%-0.6rem)]",
                  delays[index % delays.length],
                )}
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary">
                  <Boxes className="size-5" aria-hidden="true" />
                </span>
                <span className="min-w-0 truncate text-sm font-bold">{name}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

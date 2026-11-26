"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  MapPin,
  X,
} from "lucide-react";
import type { GalleryPostDTO } from "@/lib/gallery";
import { cn } from "@/lib/utils";

type Filter = "ALL" | "EVENT" | "PROGRAM";

type Lightbox = {
  postId: string;
  imageIndex: number;
};

export function GalleryBoard({ posts }: { posts: GalleryPostDTO[] }) {
  const t = useTranslations("gallery");
  const [filter, setFilter] = useState<Filter>("ALL");
  const [lightbox, setLightbox] = useState<Lightbox | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  const visible = useMemo(
    () =>
      posts.filter((post) => filter === "ALL" || post.kind === filter),
    [posts, filter],
  );

  const activePostId = lightbox?.postId;
  const activePost = activePostId
    ? visible.find((post) => post.id === activePostId)
    : undefined;
  const activeImage = activePost?.images[lightbox?.imageIndex ?? 0];

  useEffect(() => {
    if (!lightbox || !activePost) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setLightbox(null);
        return;
      }
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      event.preventDefault();
      const delta = event.key === "ArrowRight" ? 1 : -1;
      setLightbox((current) => {
        if (!current) return current;
        const count = activePost.images.length;
        return {
          ...current,
          imageIndex: (current.imageIndex + delta + count) % count,
        };
      });
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [lightbox, activePost]);

  useEffect(() => {
    if (lightbox) closeRef.current?.focus();
    // Focus only when a different post opens, not on every photo step.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePostId]);

  function step(delta: number) {
    if (!lightbox || !activePost) return;
    const count = activePost.images.length;
    setLightbox({
      ...lightbox,
      imageIndex: (lightbox.imageIndex + delta + count) % count,
    });
  }

  const filters: Array<{ key: Filter; label: string }> = [
    { key: "ALL", label: t("all") },
    { key: "EVENT", label: t("events") },
    { key: "PROGRAM", label: t("programs") },
  ];

  return (
    <div className="space-y-6">
      <nav aria-label={t("title")} className="glass flex flex-wrap gap-2 rounded-2xl p-2">
        {filters.map((item) => (
          <button
            key={item.key}
            type="button"
            aria-pressed={filter === item.key}
            onClick={() => {
              setFilter(item.key);
              setLightbox(null);
            }}
            className={cn(
              "rounded-full px-4 py-2 text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-ring",
              filter === item.key
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-primary/10 hover:text-primary",
            )}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {visible.length === 0 ? (
        <div className="glass rounded-3xl px-6 py-16 text-center">
          <h2 className="font-display text-xl font-bold">{t("emptyTitle")}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{t("emptyBody")}</p>
        </div>
      ) : (
        <div className="space-y-6">
          {visible.map((post) => (
            <article key={post.id} className="glass glass-hover overflow-hidden rounded-3xl">
              <div className="space-y-3 p-5 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-primary">
                        {post.kind === "EVENT" ? t("events") : t("programs")}
                      </span>
                      <span className="text-xs font-semibold text-muted-foreground">
                        {t("photos", { count: post.images.length })}
                      </span>
                    </div>
                    <h2 className="mt-3 font-display text-2xl font-bold tracking-tight">{post.title}</h2>
                    <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
                      {post.caption}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarDays className="size-3.5 text-primary" aria-hidden="true" />
                    {post.eventDate
                      ? t("eventOn", { date: post.dateLabel })
                      : t("postedOn", { date: post.dateLabel })}
                  </span>
                  {post.location ? (
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin className="size-3.5 text-primary" aria-hidden="true" />
                      {post.location}
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="grid gap-3 p-3 sm:grid-cols-2 lg:grid-cols-3 sm:p-4">
                {post.images.map((image, index) => (
                  <button
                    key={image.id}
                    type="button"
                    aria-label={t("open")}
                    onClick={() => setLightbox({ postId: post.id, imageIndex: index })}
                    className="group relative aspect-[4/3] overflow-hidden rounded-2xl border border-border/70 bg-muted focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Image
                      src={image.url}
                      alt={image.caption || post.title}
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      className="object-cover transition-transform duration-300 group-hover:scale-[1.04]"
                    />
                    {image.caption ? (
                      <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent px-3 pb-3 pt-8 text-left text-xs font-medium text-white">
                        {image.caption}
                      </span>
                    ) : null}
                  </button>
                ))}
              </div>
            </article>
          ))}
        </div>
      )}

      {lightbox && activePost && activeImage ? (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label={t("open")}
        >
          <button
            type="button"
            tabIndex={-1}
            aria-hidden="true"
            className="absolute inset-0 cursor-default"
            onClick={() => setLightbox(null)}
          />
          <div className="relative z-10 flex w-full max-w-5xl flex-col gap-3">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 className="truncate font-display text-lg font-bold text-white">{activePost.title}</h2>
                <p className="text-xs text-white/70">
                  {lightbox.imageIndex + 1} / {activePost.images.length}
                </p>
              </div>
              <button
                ref={closeRef}
                type="button"
                aria-label={t("close")}
                onClick={() => setLightbox(null)}
                className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white transition-colors hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-white"
              >
                <X className="size-5" aria-hidden="true" />
              </button>
            </div>

            <div className="relative aspect-[16/10] overflow-hidden rounded-2xl bg-black/40">
              <Image
                src={activeImage.url}
                alt={activeImage.caption || activePost.title}
                fill
                sizes="(max-width: 1024px) 100vw, 1024px"
                className="object-contain"
              />
              {activePost.images.length > 1 ? (
                <>
                  <button
                    type="button"
                    aria-label={t("previous")}
                    onClick={() => step(-1)}
                    className="absolute left-3 top-1/2 inline-flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white transition-colors hover:bg-black/80 focus-visible:ring-2 focus-visible:ring-white"
                  >
                    <ChevronLeft className="size-5" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    aria-label={t("next")}
                    onClick={() => step(1)}
                    className="absolute right-3 top-1/2 inline-flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white transition-colors hover:bg-black/80 focus-visible:ring-2 focus-visible:ring-white"
                  >
                    <ChevronRight className="size-5" aria-hidden="true" />
                  </button>
                </>
              ) : null}
            </div>

            {activeImage.caption ? (
              <p className="text-center text-sm text-white/85">{activeImage.caption}</p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

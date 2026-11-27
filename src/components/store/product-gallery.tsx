"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { ChevronLeft, ChevronRight, Play } from "lucide-react";
import {
  toProductVideoMedia,
  type ProductVideo,
  type ProductVideoMedia,
} from "@/lib/product-video";
import { cn } from "@/lib/utils";

type GalleryItem =
  | {
      id: string;
      kind: "image";
      src: string;
      number: number;
    }
  | {
      id: "video";
      kind: "video";
      media: ProductVideoMedia;
    };

export function ProductGallery({
  images,
  name,
  video,
}: {
  images: string[];
  name: string;
  video?: ProductVideo | null;
}) {
  const t = useTranslations("product");
  const [active, setActive] = useState(0);
  const startX = useRef<number | null>(null);
  const media = toProductVideoMedia(video);

  const items: GalleryItem[] = images.map((src, index) => ({
    id: `image-${index}`,
    kind: "image",
    src,
    number: index + 1,
  }));
  if (media) {
    items.splice(Math.min(1, items.length), 0, { id: "video", kind: "video", media });
  }

  const count = items.length;
  if (count === 0) return null;

  function goTo(index: number) {
    setActive((index + count) % count);
  }

  const activeItem = items[active];
  const thumbnails = Array.from({ length: Math.min(4, count) }, (_, offset) => ({
    item: items[(active + offset) % count],
    index: (active + offset) % count,
  }));

  return (
    <div className="space-y-3">
      <div
        className="relative aspect-square overflow-hidden rounded-3xl border border-border bg-[var(--glass)]"
        onTouchStart={(event) => {
          startX.current = event.touches[0]?.clientX ?? null;
        }}
        onTouchEnd={(event) => {
          const start = startX.current;
          startX.current = null;
          if (start === null) return;
          const delta = (event.changedTouches[0]?.clientX ?? start) - start;
          if (Math.abs(delta) < 40) return;
          goTo(active + (delta < 0 ? 1 : -1));
        }}
      >
        {activeItem.kind === "video" ? (
          activeItem.media.kind === "video" ? (
            <video
              src={activeItem.media.src}
              controls
              playsInline
              preload="metadata"
              className="size-full bg-black object-contain"
            >
              <source src={activeItem.media.src} type={activeItem.media.type} />
            </video>
          ) : (
            <iframe
              src={activeItem.media.src}
              title={t("productVideo")}
              allow="autoplay; encrypted-media; picture-in-picture"
              sandbox="allow-scripts allow-same-origin allow-autoplay allow-presentation"
              referrerPolicy="strict-origin-when-cross-origin"
              className="size-full border-0"
            />
          )
        ) : (
          <Image
            src={activeItem.src}
            alt={`${name} — ${activeItem.number}`}
            fill
            unoptimized
            loading="eager"
            fetchPriority="high"
            sizes="(max-width: 768px) 100vw, 600px"
            className="object-cover"
          />
        )}

        {count > 1 ? (
          <>
            <button
              type="button"
              onClick={() => goTo(active - 1)}
              aria-label={t("previousImage")}
              className="absolute left-3 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-[var(--card-solid)]/90 text-foreground shadow-md ring-1 ring-border transition hover:text-primary"
            >
              <ChevronLeft className="size-5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => goTo(active + 1)}
              aria-label={t("nextImage")}
              className="absolute right-3 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-[var(--card-solid)]/90 text-foreground shadow-md ring-1 ring-border transition hover:text-primary"
            >
              <ChevronRight className="size-5" aria-hidden="true" />
            </button>
          </>
        ) : null}
      </div>

      {count > 1 ? (
        <div className="grid grid-cols-4 gap-2">
          {thumbnails.map(({ item, index }) => (
            <button
              key={item.id}
              type="button"
              onClick={() => goTo(index)}
              aria-label={
                item.kind === "video"
                  ? t("productVideo")
                  : t("viewImageNumber", { number: item.number })
              }
              aria-current={index === active ? "true" : undefined}
              className={cn(
                "relative aspect-square min-w-0 overflow-hidden rounded-xl border-2 bg-muted transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                index === active ? "border-primary" : "border-transparent opacity-80 hover:opacity-100",
              )}
            >
              {item.kind === "video" ? (
                <span className="grid size-full place-items-center bg-black/70 text-white">
                  <Play className="size-5 fill-current" aria-hidden="true" />
                </span>
              ) : (
                <Image
                  src={item.src}
                  alt=""
                  fill
                  unoptimized
                  sizes="(max-width: 640px) 25vw, 150px"
                  className="object-cover"
                />
              )}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

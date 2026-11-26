"use client";

import { useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

const FALLBACK_IMAGE = "/images/store-fallback.svg";

/** Small product image with a fallback for missing or broken stored images. */
export function ProductThumb({
  src,
  alt,
  className = "size-12 rounded-xl",
  sizes = "48px",
}: {
  src: string | null | undefined;
  alt: string;
  className?: string;
  sizes?: string;
}) {
  const [failed, setFailed] = useState(false);
  const source = src?.trim() ? src : FALLBACK_IMAGE;

  return (
    <span className={cn("relative block shrink-0 overflow-hidden bg-muted ring-1 ring-border", className)}>
      <Image
        src={failed ? FALLBACK_IMAGE : source}
        alt={alt}
        fill
        unoptimized
        sizes={sizes}
        className="object-cover"
        onError={() => setFailed(true)}
      />
    </span>
  );
}

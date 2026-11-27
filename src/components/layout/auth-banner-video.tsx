"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import {
  parseAuthBannerSetting,
  toAuthBannerMedia,
  type AuthBannerSetting,
} from "@/lib/auth-banner-video";

/** Renders the admin-configured video or image over the shared auth banner. */
export function AuthBannerVideo() {
  const [setting, setSetting] = useState<AuthBannerSetting | null>(null);

  useEffect(() => {
    let active = true;
    void fetch("/api/auth-banner-video", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { video?: unknown } | null) => {
        if (!active) return;
        setSetting(parseAuthBannerSetting(data?.video));
      })
      .catch(() => {
        // The wellness image underneath is the fallback.
      });
    return () => {
      active = false;
    };
  }, []);

  const media = setting ? toAuthBannerMedia(setting) : null;
  if (!media) return null;

  if (media.kind === "image") {
    return (
      <Image
        src={media.src}
        alt=""
        aria-hidden="true"
        fill
        unoptimized
        priority
        sizes="(max-width: 767px) 100vw, 52vw"
        className="pointer-events-none absolute inset-0 z-0 size-full object-cover"
      />
    );
  }

  if (media.kind === "video") {
    return (
      <video
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        className="pointer-events-none absolute inset-0 z-0 hidden size-full object-cover motion-safe:block"
      >
        <source src={media.src} type={media.type} />
      </video>
    );
  }

  return (
    <iframe
      src={media.src}
      title=""
      tabIndex={-1}
      aria-hidden="true"
      allow="autoplay; encrypted-media; picture-in-picture"
      sandbox="allow-scripts allow-same-origin allow-autoplay allow-presentation"
      referrerPolicy="strict-origin-when-cross-origin"
      className="pointer-events-none absolute left-1/2 top-1/2 z-0 hidden h-[56.25vw] min-h-full w-[177.77vh] min-w-full -translate-x-1/2 -translate-y-1/2 border-0 motion-safe:block"
    />
  );
}

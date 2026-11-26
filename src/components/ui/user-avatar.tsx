"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

/** Avatar with an initials fallback when the uploaded image is unavailable. */
export function UserAvatar({
  name,
  src,
  className = "size-11 rounded-2xl",
  textClassName = "text-xs",
}: {
  name: string;
  src: string | null | undefined;
  className?: string;
  textClassName?: string;
}) {
  const [failed, setFailed] = useState(false);
  const initials =
    name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "?";

  return (
    <span
      role="img"
      aria-label={name}
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden bg-primary/15 text-xs font-bold text-primary ring-1 ring-primary/20",
        className,
        textClassName,
      )}
    >
      {src && !failed ? (
        // Uploaded images come from /api/uploads with unknown dimensions.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          loading="lazy"
          onError={() => setFailed(true)}
          className="size-full object-cover"
        />
      ) : (
        initials
      )}
    </span>
  );
}

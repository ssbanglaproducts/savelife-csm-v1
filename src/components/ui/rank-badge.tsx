import Image from "next/image";
import { resolveRankBadgeImageUrl } from "@/lib/rank-art";
import { cn } from "@/lib/utils";

/**
 * Official rank cutouts are transparent, so they are rendered at their full
 * bounds with `contain`. No frame, background, ring, or crop is added around
 * the art; surrounding cards provide all status styling.
 */
export function RankBadge({
  src,
  rankKey,
  size,
  className,
  preload = false,
}: {
  src: string | null | undefined;
  rankKey: string;
  size: number;
  className?: string;
  preload?: boolean;
}) {
  return (
    <Image
      src={resolveRankBadgeImageUrl(src, rankKey)}
      alt=""
      width={size}
      height={size}
      preload={preload}
      draggable={false}
      className={cn("block shrink-0 select-none object-contain", className)}
      style={{ width: size, height: size }}
    />
  );
}

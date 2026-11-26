import Image from "next/image";
import { cn } from "@/lib/utils";

export function BrandLogo({
  size = 36,
  showName = true,
  priority = false,
  className,
  wordmarkClassName,
  csmClassName,
}: {
  size?: number;
  showName?: boolean;
  priority?: boolean;
  className?: string;
  wordmarkClassName?: string;
  csmClassName?: string;
}) {
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-2.5", className)} translate="no">
      <span
        className="relative block shrink-0 overflow-hidden rounded-xl bg-[#07120d] ring-1 ring-white/20 shadow-[0_0_24px_-8px_var(--primary)]"
        style={{ width: size, height: size }}
      >
        <Image
          src="/images/savelife-logo.png"
          alt={showName ? "" : "Savelife CSM"}
          width={2000}
          height={2000}
          loading={priority ? "eager" : undefined}
          fetchPriority={priority ? "high" : undefined}
          className="size-full object-cover"
        />
      </span>
      {showName ? (
        <span
          className={cn(
            "truncate whitespace-nowrap font-display text-base font-bold leading-none tracking-tight",
            wordmarkClassName,
          )}
        >
          Savelife{" "}
          <span
            className={cn(
              "font-sans text-[10px] font-bold tracking-[0.12em] text-primary",
              csmClassName,
            )}
          >
            CSM
          </span>
        </span>
      ) : null}
    </span>
  );
}

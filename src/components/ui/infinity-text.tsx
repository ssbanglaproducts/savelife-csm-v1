import { Fragment } from "react";
import { cn } from "@/lib/utils";

/** Renders string labels while enlarging every infinity sign they contain. */
export function InfinityText({ value, className }: { value: string; className?: string }) {
  const parts = value.split("∞");
  if (parts.length === 1) return <>{value}</>;

  return (
    <>
      {parts.map((part, index) => (
        <Fragment key={index}>
          {part}
          {index < parts.length - 1 ? (
            <span
              className={cn(
                "inline-block text-[1.5em] font-bold leading-none align-middle",
                className,
              )}
            >
              ∞
            </span>
          ) : null}
        </Fragment>
      ))}
    </>
  );
}

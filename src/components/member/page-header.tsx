import type { ReactNode } from "react";
import { Sparkles } from "lucide-react";

export function PageHeader({
  eyebrow,
  title,
  intro,
  icon,
}: {
  eyebrow: string;
  title: string;
  intro?: string;
  icon?: ReactNode;
}) {
  return (
    <>
      <h1 className="sr-only sm:hidden">{title}</h1>
      <section className="mesh glass relative hidden overflow-hidden rounded-3xl p-6 sm:block sm:p-8">
        <div
          className="pointer-events-none absolute -right-20 -top-24 size-64 rounded-full bg-primary/10 blur-3xl"
          aria-hidden="true"
        />
        <div className="relative min-w-0">
          <div className="flex items-center gap-2 text-xs font-bold tracking-[0.12em] text-primary">
            {icon ?? <Sparkles className="size-3.5" aria-hidden="true" />}
            {eyebrow}
          </div>
          <h1 className="mt-3 font-display text-balance text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
            {title}
          </h1>
          {intro ? (
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              {intro}
            </p>
          ) : null}
        </div>
      </section>
    </>
  );
}

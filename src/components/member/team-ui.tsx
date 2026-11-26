import type { ReactNode } from "react";
import { UserAvatar } from "@/components/ui/user-avatar";

export function TeamAvatar({
  name,
  image,
  className = "size-11",
}: {
  name: string;
  image: string | null;
  className?: string;
}) {
  return <UserAvatar name={name} src={image} className={`${className} rounded-2xl`} />;
}

export function StatusPill({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-bold text-primary">
      {label}
    </span>
  );
}

export function TeamSection({
  id,
  title,
  intro,
  children,
}: {
  id?: string;
  title?: string;
  intro?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="min-w-0">
      {title || intro ? (
        <div className="mb-5">
          {title ? <h2 className="font-display text-xl font-bold tracking-tight">{title}</h2> : null}
          {intro ? <p className="mt-1 text-sm text-muted-foreground">{intro}</p> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

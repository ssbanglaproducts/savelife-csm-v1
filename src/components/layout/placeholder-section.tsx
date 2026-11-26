import type { ReactNode } from "react";
import { ArrowRight, Construction } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { buttonVariants } from "@/components/ui/button";

export async function PlaceholderSection({
  title,
  description,
  icon,
  showBackLink = true,
}: {
  title: string;
  description?: string;
  icon?: ReactNode;
  showBackLink?: boolean;
}) {
  const [t, tn] = await Promise.all([
    getTranslations("dashboard"),
    getTranslations("nav"),
  ]);

  return (
    <div className="animate-rise space-y-6">
      <header>
        <h1 className="font-display text-balance text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-2 text-sm text-muted-foreground">{description}</p>
        ) : null}
      </header>

      <div className="glass mesh relative overflow-hidden rounded-3xl px-6 py-16 text-center sm:py-20">
        <div className="relative flex flex-col items-center">
          <span className="glass-strong flex size-16 items-center justify-center rounded-2xl bg-primary/15 text-primary ring-1 ring-primary/20">
            {icon ?? <Construction className="size-7" aria-hidden="true" />}
          </span>
          <p className="mt-6 font-display text-xl font-bold">{t("comingSoon")}</p>
          <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
            {t("placeholderBody")}
          </p>
          {showBackLink ? (
            <Link
              href="/"
              className={`${buttonVariants({ variant: "outline", size: "sm" })} mt-6`}
            >
              {tn("store")}
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}

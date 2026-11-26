import { getTranslations, setRequestLocale } from "next-intl/server";
import {
  ArrowRight,
  HeartHandshake,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Store,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import { StoreShell } from "@/components/layout/store-shell";

export const dynamic = "force-dynamic";

type Pillar = {
  titleKey: string;
  bodyKey: string;
  icon: LucideIcon;
};

type Value = {
  titleKey: string;
  bodyKey: string;
  icon: LucideIcon;
};

export default async function AboutPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [t, tn] = await Promise.all([
    getTranslations("about"),
    getTranslations("nav"),
  ]);

  const pillars: Pillar[] = [
    { titleKey: "storeTitle", bodyKey: "storeBody", icon: ShoppingBag },
    { titleKey: "communityTitle", bodyKey: "communityBody", icon: Users },
    { titleKey: "investmentTitle", bodyKey: "investmentBody", icon: Wallet },
  ];

  const values: Value[] = [
    { titleKey: "value1Title", bodyKey: "value1Body", icon: ShieldCheck },
    { titleKey: "value2Title", bodyKey: "value2Body", icon: HeartHandshake },
    { titleKey: "value3Title", bodyKey: "value3Body", icon: Store },
  ];

  return (
    <StoreShell>
      <div className="space-y-8 animate-rise">
        <section className="mesh glass relative overflow-hidden rounded-3xl p-6 sm:p-10">
          <div
            className="pointer-events-none absolute -right-24 -top-28 size-80 rounded-full bg-primary/10 blur-3xl"
            aria-hidden="true"
          />
          <div className="relative max-w-3xl">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-primary">
              <Sparkles className="size-3.5" aria-hidden="true" />
              {t("eyebrow")}
            </div>
            <h1 className="mt-4 font-display text-balance text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
              {t("title")}
            </h1>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground sm:text-lg">
              {t("intro")}
            </p>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <article className="glass rounded-3xl p-6 sm:p-8">
            <SectionHeading title={t("storyTitle")} />
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground sm:text-base">
              {t("storyBody")}
            </p>
          </article>
          <article className="glass rounded-3xl p-6 sm:p-8">
            <SectionHeading title={t("missionTitle")} />
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground sm:text-base">
              {t("missionBody")}
            </p>
          </article>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          {pillars.map((pillar) => (
            <article key={pillar.titleKey} className="glass glass-hover rounded-3xl p-6">
              <span className="flex size-10 items-center justify-center rounded-xl bg-primary/15 text-primary ring-1 ring-primary/20">
                <pillar.icon className="size-5" aria-hidden="true" />
              </span>
              <h3 className="mt-4 font-display text-lg font-bold">{t(pillar.titleKey)}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {t(pillar.bodyKey)}
              </p>
            </article>
          ))}
        </section>

        <section className="glass rounded-3xl p-6 sm:p-8">
          <h2 className="font-display text-2xl font-bold tracking-tight">{t("valuesTitle")}</h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {values.map((value) => (
              <div key={value.titleKey} className="rounded-2xl border border-border bg-background/40 p-4">
                <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <value.icon className="size-4" aria-hidden="true" />
                </span>
                <h3 className="mt-3 font-display font-bold">{t(value.titleKey)}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {t(value.bodyKey)}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="mesh glass flex flex-col gap-5 rounded-3xl p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
          <div>
            <h2 className="font-display text-2xl font-bold tracking-tight">{t("ctaTitle")}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{t("ctaBody")}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/gallery"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:brightness-110 focus-visible:ring-2 focus-visible:ring-ring"
            >
              {t("ctaGallery")}
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
            <Link
              href="/products"
              className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-semibold transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
            >
              {tn("products")}
            </Link>
          </div>
        </section>
      </div>
    </StoreShell>
  );
}

function SectionHeading({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex size-10 items-center justify-center rounded-xl bg-primary/15 text-primary ring-1 ring-primary/20">
        <Sparkles className="size-5" aria-hidden="true" />
      </span>
      <h2 className="font-display text-xl font-bold tracking-tight">{title}</h2>
    </div>
  );
}


import { getTranslations, setRequestLocale } from "next-intl/server";
import {
  ArrowUpRight,
  Banknote,
  BookOpen,
  CircleDollarSign,
  Info,
  Layers3,
  ShieldAlert,
  Sparkles,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export const dynamic = "force-dynamic";

type Section = {
  id: string;
  titleKey: string;
  bodyKey: string;
  icon: LucideIcon;
};

export default async function ProgramPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("program");
  const sections: Section[] = [
    { id: "membership", titleKey: "membershipTitle", bodyKey: "membershipBody", icon: BookOpen },
    { id: "plans", titleKey: "plansTitle", bodyKey: "plansIntro", icon: Layers3 },
    { id: "affiliate", titleKey: "affiliateTitle", bodyKey: "affiliateBody", icon: Users },
    { id: "distribution", titleKey: "distributionTitle", bodyKey: "distributionBody", icon: CircleDollarSign },
    { id: "wallet", titleKey: "walletTitle", bodyKey: "walletBody", icon: Wallet },
    { id: "rules", titleKey: "rulesTitle", bodyKey: "rule2", icon: ShieldAlert },
    { id: "disclosure", titleKey: "riskTitle", bodyKey: "riskBody", icon: Info },
  ];

  return (
    <div className="space-y-8 animate-rise">
      <section className="mesh glass relative overflow-hidden rounded-3xl p-6 sm:p-8">
        <div className="pointer-events-none absolute -right-24 -top-28 size-72 rounded-full bg-primary/10 blur-3xl" aria-hidden="true" />
        <div className="relative min-w-0">
          <div className="flex items-center gap-2 text-xs font-bold tracking-[0.12em] text-primary">
            <Sparkles className="size-3.5" aria-hidden="true" />
            {t("title")}
          </div>
          <h1 className="mt-3 font-display text-balance text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
            {t("title")}
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            {t("intro")}
          </p>
        </div>
      </section>

      <nav aria-label={t("title")} className="glass flex flex-wrap gap-2 rounded-2xl p-3">
        {sections.map((section) => (
          <a
            key={section.id}
            href={`#${section.id}`}
            className="rounded-full px-3 py-1.5 text-xs font-bold text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary focus-visible:ring-2 focus-visible:ring-ring"
          >
            {t(section.titleKey)}
          </a>
        ))}
      </nav>

      <section id="membership" className="glass scroll-mt-24 rounded-3xl p-6 sm:p-8">
        <SectionHeading icon={BookOpen} title={t("membershipTitle")} />
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{t("membershipBody")}</p>
      </section>

      <section id="plans" className="space-y-4 scroll-mt-24">
        <div className="glass rounded-3xl p-6 sm:p-8">
          <SectionHeading icon={Layers3} title={t("plansTitle")} />
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{t("plansIntro")}</p>
          <p className="mt-4 flex gap-2 rounded-xl border-l-2 border-l-primary bg-primary/5 p-4 text-sm leading-relaxed text-muted-foreground">
            <Info className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
            {t("planNote")}
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <article className="glass glass-hover rounded-3xl p-6">
            <SectionHeading icon={CircleDollarSign} title={t("installmentTitle")} />
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{t("installmentBody")}</p>
          </article>
          <article className="glass glass-hover rounded-3xl p-6">
            <SectionHeading icon={Banknote} title={t("profitOnlyTitle")} />
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{t("profitOnlyBody")}</p>
          </article>
        </div>
      </section>

      <section id="affiliate" className="glass scroll-mt-24 rounded-3xl p-6 sm:p-8">
        <SectionHeading icon={Users} title={t("affiliateTitle")} />
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{t("affiliateBody")}</p>
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {(["level1", "level2", "level3"] as const).map((key) => (
            <div key={key} className="rounded-2xl border border-border bg-background/40 p-4">
              <p className="font-display text-lg font-bold text-primary">{t(key)}</p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-sm leading-relaxed text-amber-500">{t("noBackfill")}</p>
        <p className="mt-3 flex gap-2 rounded-xl border-l-2 border-l-primary bg-primary/5 p-4 text-sm leading-relaxed text-muted-foreground">
          <Info className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
          {t("sponsorOnlyRewards")}
        </p>
      </section>

      <section id="distribution" className="glass scroll-mt-24 rounded-3xl p-6 sm:p-8">
        <SectionHeading icon={CircleDollarSign} title={t("distributionTitle")} />
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{t("distributionBody")}</p>
      </section>

      <section id="wallet" className="glass scroll-mt-24 rounded-3xl p-6 sm:p-8">
        <SectionHeading icon={Wallet} title={t("walletTitle")} />
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{t("walletBody")}</p>
      </section>

      <section id="rules" className="glass scroll-mt-24 rounded-3xl p-6 sm:p-8">
        <SectionHeading icon={ShieldAlert} title={t("rulesTitle")} />
        <ol className="mt-5 grid gap-3 sm:grid-cols-2">
          {(["rule1", "rule2", "rule3", "rule4", "rule5"] as const).map((key, index) => (
            <li key={key} className="flex gap-3 rounded-2xl border border-border bg-background/40 p-4 text-sm leading-relaxed text-muted-foreground">
              <span className="font-display font-bold text-primary">{String(index + 1).padStart(2, "0")}</span>
              <span>{t(key)}</span>
            </li>
          ))}
        </ol>
      </section>

      <section id="disclosure" className="glass scroll-mt-24 rounded-3xl border-l-2 border-l-amber-500 p-6 sm:p-8">
        <SectionHeading icon={Info} title={t("riskTitle")} />
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{t("riskBody")}</p>
        <div className="mt-6 border-t border-border pt-6">
          <h2 className="font-display text-lg font-bold">{t("disclosureTitle")}</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t("disclosureBody")}</p>
        </div>
      </section>

      <div className="flex flex-wrap gap-3 pb-4">
        <a
          href="#plans"
          className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
        >
          {t("plansTitle")}
          <ArrowUpRight className="size-3.5" aria-hidden="true" />
        </a>
        <span className="text-sm text-muted-foreground">·</span>
        <a href="#disclosure" className="text-sm font-semibold text-primary hover:underline">
          {t("disclosureTitle")}
        </a>
      </div>
    </div>
  );
}

function SectionHeading({ icon: Icon, title }: { icon: LucideIcon; title: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex size-10 items-center justify-center rounded-xl bg-primary/15 text-primary ring-1 ring-primary/20">
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <h2 className="font-display text-xl font-bold tracking-tight">{title}</h2>
    </div>
  );
}

import { getTranslations, setRequestLocale } from "next-intl/server";
import { Images, Sparkles } from "lucide-react";
import { StoreShell } from "@/components/layout/store-shell";
import { GalleryBoard } from "@/components/store/gallery-board";
import { getPublicGalleryPosts } from "@/lib/gallery";

export const dynamic = "force-dynamic";

export default async function GalleryPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("gallery");
  const posts = await getPublicGalleryPosts(locale === "bn" ? "bn" : "en");

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
            <h1 className="mt-4 flex items-center gap-3 font-display text-balance text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
              <Images className="size-9 shrink-0 text-primary" aria-hidden="true" />
              {t("title")}
            </h1>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground sm:text-lg">
              {t("intro")}
            </p>
          </div>
        </section>

        <GalleryBoard posts={posts} />
      </div>
    </StoreShell>
  );
}

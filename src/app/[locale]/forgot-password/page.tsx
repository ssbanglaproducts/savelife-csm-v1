import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowLeft, LifeBuoy } from "lucide-react";
import { Header } from "@/components/layout/header";
import { SiteFooter } from "@/components/layout/site-footer";
import { Link } from "@/i18n/navigation";
import { buttonVariants } from "@/components/ui/button";

export default async function ForgotPasswordPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("auth");

  return (
    <>
      <Header />
      <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-2xl flex-1 px-4 py-16 sm:px-6">
        <section className="glass rounded-3xl p-7 shadow-xl animate-rise sm:p-10">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/15 text-primary ring-1 ring-primary/20">
            <LifeBuoy className="size-5" aria-hidden="true" />
          </span>
          <h1 className="mt-5 font-display text-3xl font-bold tracking-tight">{t("forgotPasswordTitle")}</h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            {t("forgotPasswordBody")}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/login" className={buttonVariants({ variant: "outline" })}>
              <ArrowLeft className="size-4" aria-hidden="true" />
              {t("backToLogin")}
            </Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}

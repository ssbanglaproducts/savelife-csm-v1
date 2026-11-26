import { Suspense } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AuthShell } from "@/components/layout/auth-shell";
import { RegisterForm } from "@/components/store/register-form";
import { auth } from "@/auth";
import { redirect } from "@/i18n/navigation";

export const dynamic = "force-dynamic";

export default async function RegisterPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, session] = await Promise.all([getTranslations("auth"), auth()]);

  if (session?.user?.id) {
    redirect({
      href: session.user.role === "ADMIN" ? "/admin/dashboard" : "/member/dashboard",
      locale,
    });
    return null;
  }

  return (
    <AuthShell>
      <div className="animate-rise">
        <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
          {t("registerTitle")}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("registerSubtitle")}</p>
        <div className="mt-8">
          <Suspense fallback={null}>
            <RegisterForm />
          </Suspense>
        </div>
      </div>
    </AuthShell>
  );
}

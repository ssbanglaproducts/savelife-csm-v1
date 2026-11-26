import { getTranslations, setRequestLocale } from "next-intl/server";
import { LockKeyhole, Wallet } from "lucide-react";
import { auth } from "@/auth";
import { StoreShell } from "@/components/layout/store-shell";
import { CheckoutForm } from "@/components/store/checkout-form";
import { ProductThumb } from "@/components/store/product-thumb";
import { buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { getCartSummary } from "@/lib/cart";
import { formatSP, formatTaka } from "@/lib/money";
import { canUseCart } from "@/lib/purchase-rules";
import { prisma } from "@/lib/prisma";
import { cn } from "@/lib/utils";
import type { Viewer } from "@/lib/viewer";

export const dynamic = "force-dynamic";

export default async function CheckoutPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [t, tc, tn, tcart, tm, session, cart] = await Promise.all([
    getTranslations("checkout"),
    getTranslations("common"),
    getTranslations("nav"),
    getTranslations("cart"),
    getTranslations("memberPanel"),
    auth(),
    getCartSummary(),
  ]);

  let memberStatus: "ACTIVE" | "INACTIVE" | "SUSPENDED" | null = null;
  let availablePaisa = 0n;
  let viewer: Viewer | null = null;
  if (session?.user?.id) {
    const [member, wallet] = await Promise.all([
      prisma.member.findUnique({
        where: { id: session.user.id },
        select: {
          status: true,
          fullName: true,
          phone: true,
          profileImage: true,
          memberId: true,
          role: true,
        },
      }),
      prisma.wallet.findUnique({
        where: { memberId: session.user.id },
        select: { availablePaisa: true },
      }),
    ]);
    memberStatus = member?.status ?? null;
    availablePaisa = wallet?.availablePaisa ?? 0n;
    if (member) {
      viewer = {
        name: member.fullName,
        phone: member.phone,
        image: member.profileImage,
        memberId: member.memberId,
        role: member.role,
        status: member.status,
      };
    }
  }

  if (memberStatus && !canUseCart(memberStatus)) {
    return (
      <StoreShell maxWidth="max-w-3xl">
          <section className="glass rounded-3xl px-6 py-14 text-center">
            <h2 className="font-display text-2xl font-bold">
              {memberStatus === "SUSPENDED" ? t("accountSuspendedTitle") : t("inactiveCheckoutTitle")}
            </h2>
            <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
              {memberStatus === "SUSPENDED" ? t("accountSuspendedBody") : t("inactiveCheckoutBody")}
            </p>
            <Link href="/products" className={cn(buttonVariants(), "mt-6")}>
              {tc("backToStore")}
            </Link>
          </section>
      </StoreShell>
    );
  }

  return (
    <StoreShell maxWidth="max-w-6xl">
      <header className="mb-8">
        <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">{t("title")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("intro")}</p>
      </header>

        {!session?.user ? (
          <section className="glass flex flex-col items-center rounded-3xl px-6 py-16 text-center">
            <span className="flex size-16 items-center justify-center rounded-2xl bg-primary/15 text-primary">
              <LockKeyhole className="size-7" aria-hidden="true" />
            </span>
            <h2 className="mt-5 font-display text-2xl font-bold">{t("loginRequiredTitle")}</h2>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
              {t("loginRequiredBody")}
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link href="/login" className={buttonVariants()}>
                {tn("login")}
              </Link>
              <Link href="/register" className={buttonVariants({ variant: "outline" })}>
                {tn("register")}
              </Link>
            </div>
          </section>
        ) : memberStatus === "SUSPENDED" ? (
          <section className="glass flex flex-col items-center rounded-3xl px-6 py-16 text-center">
            <span className="flex size-16 items-center justify-center rounded-2xl bg-primary/15 text-primary">
              <LockKeyhole className="size-7" aria-hidden="true" />
            </span>
            <h2 className="mt-5 font-display text-2xl font-bold">{t("accountSuspendedTitle")}</h2>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
              {t("accountSuspendedBody")}
            </p>
          </section>
        ) : cart.lines.length === 0 ? (
          <section className="glass rounded-3xl px-6 py-16 text-center">
            <h2 className="font-display text-2xl font-bold">{tc("noResults")}</h2>
            <Link href="/products" className={cn(buttonVariants(), "mt-6")}>
              {tc("backToStore")}
            </Link>
          </section>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
            <CheckoutForm
              cart={cart}
              availablePaisa={availablePaisa}
              locale={locale}
              viewer={viewer ?? {
                name: session.user.name ?? "Member",
                phone: "",
                image: session.user.image ?? null,
                memberId: session.user.memberId ?? "",
                role: "MEMBER",
                status: "ACTIVE",
              }}
            />
            <aside className="glass h-fit rounded-3xl p-6">
              <h2 className="font-display text-lg font-bold">{t("summary")}</h2>
              <div className="mt-5 flex items-center justify-between gap-3 rounded-2xl border border-primary/20 bg-primary/[0.04] px-4 py-3 text-sm">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Wallet className="size-4 text-primary" aria-hidden="true" />
                  {tm("available")}
                </span>
                <span className="font-bold tabular-nums">{formatSP(availablePaisa)}</span>
              </div>
              <ul className="mt-5 space-y-3">
                {cart.lines.map((line) => (
                  <li key={line.productId} className="flex items-start justify-between gap-4 text-sm">
                    <span className="flex min-w-0 items-center gap-3 text-muted-foreground">
                      <ProductThumb
                        src={line.image}
                        alt={locale === "bn" && line.nameBn ? line.nameBn : line.name}
                      />
                      <span className="min-w-0 truncate">
                        {locale === "bn" && line.nameBn ? line.nameBn : line.name}
                        <span className="block text-xs">× {line.quantity}</span>
                      </span>
                    </span>
                    <span className="shrink-0 font-semibold tabular-nums">
                      {formatTaka(BigInt(line.lineTotalPaisa), locale)}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="mt-5 flex justify-between border-t border-border pt-5 text-base font-bold">
                <span>{tcart("total")}</span>
                <span className="tabular-nums">{formatTaka(BigInt(cart.subtotalPaisa), locale)}</span>
              </div>
            </aside>
          </div>
        )}
    </StoreShell>
  );
}

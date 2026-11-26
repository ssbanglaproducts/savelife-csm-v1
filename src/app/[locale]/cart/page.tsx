import { getTranslations, setRequestLocale } from "next-intl/server";
import { auth } from "@/auth";
import { StoreShell } from "@/components/layout/store-shell";
import { CartView } from "@/components/store/cart-view";
import { buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { getCartSummary } from "@/lib/cart";
import { getMemberStatus } from "@/lib/member-access";
import { canUseCart } from "@/lib/purchase-rules";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function CartPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [t, tp, session, cart] = await Promise.all([
    getTranslations("cart"),
    getTranslations("purchase"),
    auth(),
    getCartSummary(),
  ]);

  const memberStatus =
    session?.user?.role === "MEMBER" ? await getMemberStatus(session.user.id) : null;

  if (!canUseCart(memberStatus)) {
    return (
      <StoreShell maxWidth="max-w-3xl">
          <section className="glass rounded-3xl px-6 py-14 text-center">
            <h1 className="font-display text-2xl font-bold">{tp("cartDisabledTitle")}</h1>
            <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
              {tp("cartDisabledBody")}
            </p>
            <Link href="/products" className={cn(buttonVariants(), "mt-6")}>
              {t("continueShopping")}
            </Link>
          </section>
      </StoreShell>
    );
  }

  return (
    <StoreShell>
      <header className="mb-8">
        <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">{t("title")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("intro")}</p>
      </header>
      <CartView initialCart={cart} locale={locale} canCheckout={Boolean(session?.user)} />
    </StoreShell>
  );
}

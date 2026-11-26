import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, Sora, Hind_Siliguri, Anek_Bangla } from "next/font/google";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { QueryProvider } from "@/components/providers/query-provider";
import { SkipLink } from "@/components/layout/skip-link";
import { routing } from "@/i18n/routing";
import { AppToaster } from "@/components/layout/toaster";
import "../globals.css";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-jakarta",
});

const sora = Sora({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sora",
});

const hind = Hind_Siliguri({
  subsets: ["bengali", "latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-hind",
});

const anek = Anek_Bangla({
  subsets: ["bengali", "latin"],
  display: "swap",
  variable: "--font-anek",
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export const metadata: Metadata = {
  title: {
    default: "Savelife CSM",
    template: "%s · Savelife CSM",
  },
  description:
    "Savelife CSM — e-commerce, membership, affiliate and investment management platform.",
  applicationName: "Savelife CSM",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f3f6f8" },
    { media: "(prefers-color-scheme: dark)", color: "#060b12" },
  ],
};

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  setRequestLocale(locale);
  const messages = await getMessages();

  return (
    <html
      lang={locale}
      suppressHydrationWarning
      className={`h-full antialiased ${jakarta.variable} ${sora.variable} ${hind.variable} ${anek.variable}`}
    >
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <ThemeProvider>
          <NextIntlClientProvider messages={messages}>
            <SkipLink />
            <QueryProvider>{children}</QueryProvider>
            <AppToaster />
          </NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

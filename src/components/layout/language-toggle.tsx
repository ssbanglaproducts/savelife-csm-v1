"use client";

import { Globe } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function LanguageToggle({ className }: { className?: string }) {
  const t = useTranslations("common");
  const locale = useLocale();
  const pathname = usePathname();
  const nextLocale = locale === "en" ? "bn" : "en";
  const nextLanguage = locale === "en" ? t("bangla") : t("english");
  const label = t("languageTo", { language: nextLanguage });

  return (
    <Link
      href={pathname}
      locale={nextLocale}
      className={cn(
        buttonVariants({ variant: "ghost", size: "icon" }),
        "size-10 shrink-0 [&_svg]:size-4",
        className,
      )}
      aria-label={label}
      title={label}
    >
      <Globe aria-hidden="true" />
    </Link>
  );
}

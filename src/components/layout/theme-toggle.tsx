"use client";

import { useTheme } from "next-themes";
import { useTranslations } from "next-intl";
import { Moon, Sun } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const controlClass = "size-10 [&_svg]:size-4 [&_svg]:shrink-0";

export function ThemeToggle({ className }: { className?: string }) {
  const { setTheme } = useTheme();
  const t = useTranslations("common");

  // Two static, CSS-swapped buttons keep the action label correct before and
  // after hydration. Only one is displayed, so assistive tech sees one control.
  return (
    <>
      <button
        type="button"
        className={cn(buttonVariants({ variant: "ghost", size: "icon" }), controlClass, "dark:hidden", className)}
        onClick={() => setTheme("dark")}
        aria-label={t("themeToDark")}
        title={t("themeToDark")}
      >
        <Moon aria-hidden="true" />
      </button>
      <button
        type="button"
        className={cn(buttonVariants({ variant: "ghost", size: "icon" }), controlClass, "hidden dark:inline-flex", className)}
        onClick={() => setTheme("light")}
        aria-label={t("themeToLight")}
        title={t("themeToLight")}
      >
        <Sun aria-hidden="true" />
      </button>
    </>
  );
}

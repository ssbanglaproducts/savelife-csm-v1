"use client";

import { useState } from "react";
import { LogOut } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { SignOutConfirmDialog } from "./sign-out-confirm-dialog";

export function LogoutButton() {
  const t = useTranslations("nav");
  const [confirming, setConfirming] = useState(false);

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        aria-label={t("logout")}
        onClick={() => setConfirming(true)}
        className="text-red-500 hover:bg-red-500/15 hover:text-red-600 focus-visible:ring-red-500/50 dark:text-red-400 dark:hover:text-red-300"
      >
        <LogOut className="size-4" aria-hidden="true" />
        <span className="hidden sm:inline">{t("logout")}</span>
      </Button>
      <SignOutConfirmDialog open={confirming} onCancel={() => setConfirming(false)} />
    </>
  );
}

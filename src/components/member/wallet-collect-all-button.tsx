"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { formatSP } from "@/lib/money";

export function WalletCollectAllButton() {
  const tPanel = useTranslations("memberPanel");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleClick() {
    if (pending) return;
    setPending(true);
    try {
      const response = await fetch("/api/member/wallet/collect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idempotencyKey: `collect:${Date.now()}:${Math.random().toString(36).slice(2)}`,
        }),
      });
      const data = (await response.json()) as { error?: string; collectedPaisa?: string };

      if (!response.ok) {
        const code = data.error;
        if (code === "MEMBER_NOT_ACTIVE") {
          toast.error(tPanel("memberNotActiveError"));
        } else if (code === "DUPLICATE_REQUEST") {
          toast.error(tPanel("duplicateRequestError"));
        } else if (code === "WALLET_NOT_FOUND") {
          toast.error(tPanel("walletNotFoundError"));
        } else {
          toast.error(tCommon("error"));
        }
        return;
      }

      const collected = BigInt(data.collectedPaisa ?? "0");
      if (collected > 0n) {
        toast.success(`${tPanel("collectAllSuccess")} ${formatSP(collected)}`);
      } else {
        toast.info(tPanel("collectAllNothing"));
      }
      router.refresh();
    } catch {
      toast.error(tCommon("error"));
    } finally {
      setPending(false);
    }
  }

  return (
    <Button type="button" onClick={handleClick} disabled={pending} size="lg">
      {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
      {tPanel("collectAll")}
    </Button>
  );
}

"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AdminError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  const tc = useTranslations("common");

  useEffect(() => {
    console.error("Admin panel render error", error);
  }, [error]);

  return (
    <div
      role="alert"
      className="glass flex min-h-[18rem] flex-col items-center justify-center gap-4 rounded-2xl p-8 text-center sm:min-h-[24rem] sm:rounded-3xl"
    >
      <p className="max-w-md text-sm font-semibold text-muted-foreground">{tc("error")}</p>
      <Button type="button" onClick={retry}>
        <RotateCcw className="size-4" aria-hidden="true" />
        {tc("retry")}
      </Button>
    </div>
  );
}

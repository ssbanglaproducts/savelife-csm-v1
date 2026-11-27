import { getTranslations } from "next-intl/server";
import { Loader2 } from "lucide-react";

export default async function AdminLoading() {
  const tc = await getTranslations("common");

  return (
    <div
      role="status"
      aria-live="polite"
      className="glass flex min-h-[18rem] flex-col items-center justify-center gap-3 rounded-2xl p-8 text-center sm:min-h-[24rem] sm:rounded-3xl"
    >
      <Loader2
        className="size-6 animate-spin text-primary motion-reduce:animate-none"
        aria-hidden="true"
      />
      <p className="text-sm font-semibold text-muted-foreground">{tc("loading")}</p>
    </div>
  );
}

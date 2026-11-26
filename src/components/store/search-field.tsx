import { Search } from "lucide-react";
import { getTranslations } from "next-intl/server";

export async function SearchField({
  action,
  defaultValue = "",
  hidden,
}: {
  action: string;
  defaultValue?: string;
  hidden?: Record<string, string>;
}) {
  const t = await getTranslations("catalogue");
  const tc = await getTranslations("common");

  return (
    <form action={action} method="get" className="relative w-full">
      <input
        type="search"
        name="q"
        defaultValue={defaultValue}
        placeholder={t("searchPlaceholder")}
        aria-label={t("searchPlaceholder")}
        className="h-12 w-full rounded-xl border border-border bg-[var(--card-solid)] pl-4 pr-12 text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-ring"
      />
      {Object.entries(hidden ?? {}).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <button
        type="submit"
        aria-label={tc("search")}
        className="absolute right-1.5 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-lg bg-primary text-primary-foreground transition hover:brightness-110 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <Search className="size-4" aria-hidden="true" />
      </button>
    </form>
  );
}

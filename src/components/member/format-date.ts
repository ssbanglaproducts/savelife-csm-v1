/** Shared date formatting for member panel pages. Locale comes from the route. */
export function formatMemberDate(value: Date | null, locale: string, withTime = false) {
  if (!value) return "—";
  return new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-BD", {
    dateStyle: "medium",
    ...(withTime ? { timeStyle: "short" } : {}),
  }).format(value);
}

const SALARY_TIME_ZONE = "Asia/Dhaka";

/** Salary dates follow the Bangladesh weekly boundary, not the server locale. */
export function formatSalaryDate(
  value: Date | null | undefined,
  locale: string,
  withTime = false,
): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-BD", {
    dateStyle: "medium",
    ...(withTime ? { timeStyle: "short" } : {}),
    timeZone: SALARY_TIME_ZONE,
  }).format(value);
}

/** YYYY-MM-DD key for client-side date filters, in Bangladesh time. */
export function salaryDateKey(value: Date | null | undefined): string {
  if (!value) return "";
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: SALARY_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

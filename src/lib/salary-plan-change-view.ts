import { formatSP, spToPaisa } from "./money";
import { salaryPlanDate } from "./salary-plan-form";
import type { SalaryPlanChangeDto } from "./services/salary-plan";

export type SalaryPlanTranslator = (
  key: string,
  values?: Record<string, string | number>,
) => string;

export function salaryChangeRankLabel(
  change: SalaryPlanChangeDto,
  ta: SalaryPlanTranslator,
): string {
  return change.scope === "plan"
    ? ta("salaryPlanPlanScope")
    : `${change.rankLabel} (${change.rankKey})`;
}

export function salaryChangeSettingLabel(
  change: SalaryPlanChangeDto,
  ta: SalaryPlanTranslator,
): string {
  switch (change.settingKey) {
    case "isEnabled":
      return ta("salaryPlanSettingEnabled");
    case "allocation":
      return ta("salaryPlanSettingAllocation");
    case "weeklyCap":
      return ta("salaryPlanSettingWeeklyCap");
    case "duration":
      return ta("salaryPlanSettingDuration");
    case "effectiveFrom":
      return ta("salaryPlanEffectiveDate");
  }
}

export function salaryChangeValue(
  value: string,
  settingKey: SalaryPlanChangeDto["settingKey"],
  locale: string,
  ta: SalaryPlanTranslator,
): string {
  if (!value) return "—";
  if (settingKey === "isEnabled") {
    return value === "true" ? ta("salaryPlanEnabled") : ta("salaryPlanDisabled");
  }
  if (settingKey === "duration") {
    return value === "ongoing"
      ? ta("unlimitedDuration")
      : ta("limitedWeeks", { weeks: value });
  }
  if (settingKey === "allocation") return `${value}%`;
  if (settingKey === "weeklyCap") return formatSP(spToPaisa(value));
  if (settingKey === "effectiveFrom") {
    const day = salaryPlanDate(value);
    const parsed = new Date(`${day}T00:00:00+06:00`);
    return Number.isNaN(parsed.getTime())
      ? value
      : new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(parsed);
  }
  return value;
}

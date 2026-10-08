import { localeTag } from "./locales";
import { useLanguageStore } from "./store";

export function formatDailyDate(dateISO: string): string {
  const date = new Date(`${dateISO}T12:00:00`);
  if (!Number.isFinite(date.getTime())) return dateISO;
  return new Intl.DateTimeFormat(localeTag(useLanguageStore.getState().locale), { day: "2-digit", month: "2-digit" }).format(date);
}

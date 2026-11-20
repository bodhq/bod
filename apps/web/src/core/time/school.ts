export function today(): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Prague" }).format(new Date());
}
export function addDays(day: string, count: number): string {
  const value = new Date(`${day}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + count);
  return value.toISOString().slice(0, 10);
}
export function monday(day: string): string {
  const weekday = new Date(`${day}T12:00:00Z`).getUTCDay();
  return addDays(day, -(weekday === 0 ? 6 : weekday - 1));
}
export function dateLabel(value: string, withTime = false) {
  return new Date(value.length === 10 ? `${value}T12:00:00Z` : value).toLocaleString("cs-CZ", {
    timeZone: "Europe/Prague",
    dateStyle: "medium",
    ...(withTime ? { timeStyle: "short" as const } : {}),
  });
}
export function localInstant(value: string): string {
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Prague",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(value));
  return parts.replace(" ", "T");
}
export function schoolInstant(value: string): string {
  const target = Date.parse(`${value}:00Z`);
  if (!Number.isFinite(target)) throw new Error("Zadejte platné datum a čas.");
  let instant = target;
  for (let i = 0; i < 3; i++) {
    const rendered = Date.parse(`${localInstant(new Date(instant).toISOString())}:00Z`);
    instant += target - rendered;
  }
  if (localInstant(new Date(instant).toISOString()) !== value)
    throw new Error("Tento místní čas při změně letního času neexistuje.");
  return new Date(instant).toISOString();
}

import type { Row } from "@/modules/shared/records/types";

export const valueLabels: Record<string, string> = {
  draft: "Návrh",
  published: "Publikováno",
  archived: "Archivováno",
  signed: "Podepsáno",
  open: "Otevřená",
  closed: "Uzavřená",
  withdrawn: "Stažená",
  pending: "Čeká na rozhodnutí",
  approved: "Schváleno",
  rejected: "Zamítnuto",
  present: "Přítomen",
  absent: "Nepřítomen",
  late: "Pozdní příchod",
  released_early: "Předčasný odchod",
  alphabetical: "Abecedně",
  specialization: "Podle zaměření",
  study_field: "Podle oboru studia",
  manual: "Ručně",
  generated: "Vygenerované",
  class_enrollment: "Podle zařazení do třídy",
  explicit: "Samostatné členství",
  cancelled: "Zrušení",
  modified: "Změna hodiny",
  moved: "Přesun",
  substitution: "Suplování",
  teacher: "Učitel",
  room: "Učebna",
};
export const shortId = (value: unknown) => String(value ?? "").slice(0, 8);
export function rowLabel(row: Row): string {
  return String(
    row.display_name ||
      [row.first_name, row.last_name].filter(Boolean).join(" ") ||
      row.name ||
      row.username ||
      row.code ||
      (typeof row.number === "number" ? `${row.number}. patro` : "") ||
      row.topic ||
      row.reason ||
      (row.start_time ? `${row.position}. · ${row.start_time}–${row.end_time}` : "") ||
      row.scheduled_date ||
      row.week_starts_on ||
      row.calendar_date ||
      shortId(row.id),
  );
}
export { addDays, dateLabel, localInstant, monday, schoolInstant, today } from "@/core/time/school";

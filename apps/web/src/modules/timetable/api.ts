/**
 * VRSTVA 1: DATA ACCESS (API)
 * Toto je jediné místo ve frontend modulu, které smí posílat HTTP dotazy
 * na backend. Využívá k tomu vygenerovaného klienta `@bod/api-client`.
 *
 * Pravidlo: Zákaz používání nativního `fetch()` přímo v komponentách.
 * Veškerá datová výměna musí proudit přes tyto funkce, abychom zaručili
 * typovou bezpečnost a zachytávání chyb na jednom místě.
 */

import { getTimetableApiV1TimetableClassIdGet } from "@bod/api-client";

import { env } from "@/env";

export async function fetchClassTimetable(classId: number) {
  // Příklad wrapperu okolo generovaného klienta
  // V reálné aplikaci zde lze přidat logování, transformaci dat atd.
  const { data, error } = await getTimetableApiV1TimetableClassIdGet({
    baseUrl: env.NEXT_PUBLIC_API_BASE_URL,
    path: { class_id: classId },
  });

  if (error) {
    throw new Error("Nepodařilo se načíst rozvrh.");
  }

  return data;
}

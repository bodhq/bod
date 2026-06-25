/**
 * VRSTVA 2: LOGIC & STATE (Hooks)
 * Slouží jako "mozek" komponenty. Všechna složitá logika, správa stavu (useState),
 * a stahování dat na klientovi patří sem.
 *
 * Výhoda: Udržuje UI komponenty (vrstva 3) naprosto hloupé a jednoduše testovatelné.
 */

// Generované typy se dají importovat přímo z klienta
import type { LessonPublic } from "@bod/api-client";
import { useEffect, useState } from "react";
import { fetchClassTimetable } from "../api";

export function useTimetable(classId: number) {
  const [lessons, setLessons] = useState<LessonPublic[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      setIsLoading(true);
      try {
        const data = await fetchClassTimetable(classId);
        if (isMounted && data) {
          setLessons(data);
        }
      } catch (_err) {
        if (isMounted) setError("Nepodařilo se načíst rozvrh.");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    load();

    return () => {
      isMounted = false;
    };
  }, [classId]);

  return { lessons, isLoading, error };
}

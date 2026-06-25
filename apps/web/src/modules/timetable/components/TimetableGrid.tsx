"use client";

/**
 * VRSTVA 3: UI PRESENTATION (Komponenty)
 * Toto jsou "hloupá kreslítka". Komponenta má za úkol pouze vzít data
 * a hezky je vykreslit pomocí Tailwind CSS.
 *
 * Pravidlo: Nesmí se zde objevovat fetch(), manipulace s localStorage,
 * nebo složité výpočty. O to vše se starají Hooks (vrstva 2).
 */

import { useTimetable } from "../hooks/useTimetable";

interface Props {
  classId: number;
}

export function TimetableGrid({ classId }: Props) {
  // Komponenta pouze zavolá hook a ten jí dá připravená data a stavy
  const { lessons, isLoading, error } = useTimetable(classId);

  if (isLoading) return <div className="text-gray-400">Načítám rozvrh...</div>;
  if (error) return <div className="text-red-500">{error}</div>;

  return (
    <div className="grid grid-cols-5 gap-4">
      {lessons.map((lesson) => (
        <div
          key={lesson.id}
          className="p-4 bg-gray-800 rounded-lg border border-gray-700"
        >
          <div className="text-lime-400 font-bold">{lesson.subject}</div>
          <div className="text-sm text-gray-300">{lesson.room}</div>
          <div className="text-xs text-gray-500 mt-2">
            {lesson.start_time} - {lesson.end_time}
          </div>
        </div>
      ))}
    </div>
  );
}

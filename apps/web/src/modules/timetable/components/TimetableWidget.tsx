import { getTimetableApiV1TimetableClassIdGet } from "@bod/api-client";

export async function TimetableWidget() {
  // Připojíme se přes fetch k FastAPI backendu přes Docker/lokální síť.
  // Pro lokální dev je to typicky localhost:8000
  const API_URL =
    process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

  const { data, error } = await getTimetableApiV1TimetableClassIdGet({
    baseUrl: API_URL,
    path: { class_id: 1 },
  });

  return (
    <div className="rounded-lg border border-(--color-border) bg-(--color-surface-raised)">
      <div className="border-(--color-border-subtle) border-b px-5 py-4">
        <h2 className="font-semibold text-lg">Dnešní rozvrh (Třída 1)</h2>
      </div>
      <div className="p-5">
        {error ? (
          <div className="flex items-center justify-center rounded-md border border-red-500/50 bg-red-500/10 py-12 text-red-500">
            Nepodařilo se načíst rozvrh. (Je zapnutý backend?)
          </div>
        ) : !data || data.length === 0 ? (
          <div className="flex items-center justify-center rounded-md border border-(--color-border-subtle) border-dashed py-12 text-(--color-text-secondary)">
            Zatím žádné rozvrhy.
          </div>
        ) : (
          <ul className="space-y-3">
            {data.map((lesson) => (
              <li
                key={lesson.id}
                className="flex justify-between rounded-md border border-(--color-border-subtle) p-4"
              >
                <div>
                  <div className="font-medium text-(--color-text-primary)">
                    {lesson.subject}
                  </div>
                  <div className="text-(--color-text-secondary) text-sm">
                    Učebna: {lesson.room}
                  </div>
                </div>
                <div className="text-right text-(--color-text-secondary) text-sm">
                  <div>
                    {lesson.start_time} - {lesson.end_time}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

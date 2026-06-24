import { TimetableWidget } from "@/modules/timetable/components/TimetableWidget";

export const dynamic = "force-dynamic";

export default function Home() {
  return (
    <main className="min-h-screen bg-(--color-surface) text-(--color-text-primary)">
      <header className="border-(--color-border) border-b bg-(--color-surface-raised)">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <div>
            <p className="font-semibold text-(--color-accent) text-sm uppercase tracking-wide">
              bod
            </p>
            <h1 className="font-semibold text-2xl text-(--color-text-primary)">
              Pracovní prostor školy
            </h1>
          </div>
          <div className="rounded-md border border-(--color-muted-border) px-3 py-2 text-(--color-text-secondary) text-sm">
            Lokální vývoj
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-4xl px-6 py-8">
        <TimetableWidget />
      </section>
    </main>
  );
}

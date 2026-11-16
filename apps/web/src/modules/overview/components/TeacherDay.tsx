"use client";
import Link from "next/link";

import { dateLabel } from "@/core/time/school";
import { EmptyState } from "@/core/ui/feedback/EmptyState";
import { ErrorState } from "@/core/ui/feedback/ErrorState";
import { LoadingState } from "@/core/ui/feedback/LoadingState";
import { Panel } from "@/core/ui/layout/Panel";
import { journalHref } from "@/modules/classbook/journal";

import { useTeacherDay } from "../hooks/useTeacherDay";

export function TeacherDay() {
  const { day, schedule, lessons, names, pages, completed, next, time } = useTeacherDay();
  if (schedule.isLoading || lessons.isLoading)
    return <LoadingState>Načítám vaši dnešní výuku…</LoadingState>;
  if (schedule.isError || lessons.isError)
    return (
      <ErrorState
        title="Dnešní výuku se nepodařilo načíst"
        error={schedule.error ?? lessons.error}
      />
    );
  return (
    <section className="ui-stack" aria-label="Dnešní výuka">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-(--color-muted-foreground)">{dateLabel(day)}</p>
          <h2 className="mt-1 text-2xl font-semibold">Dnes ve škole</h2>
        </div>
        <p className="text-sm text-(--color-muted-foreground)">
          Podepsané zápisy: {completed} z {pages.length}
        </p>
      </div>
      {pages.length > 0 && (
        <div
          className="visual-journal-progress"
          role="img"
          aria-label={`${completed} z ${pages.length} hodin podepsáno`}
        >
          {pages.map((page) => (
            <span key={page.key} data-done={page.entry?.status === "signed"} />
          ))}
        </div>
      )}
      {!pages.length ? (
        <EmptyState title="Dnes nemáte naplánovanou výuku">
          Další dny najdete ve svém rozvrhu. Mimořádnou výuku můžete zapsat v třídní knize.
        </EmptyState>
      ) : (
        <Panel padded={false} as="div" className="overflow-hidden">
          {pages.map((page) => {
            const subject = page.entry?.subject_id ?? page.lesson?.subject_id ?? "";
            const group = page.entry?.group_id ?? page.lesson?.group_id ?? "";
            return (
              <Link
                key={page.key}
                href={journalHref(page, day)}
                className={`ui-list-item flex flex-wrap items-center gap-4 border-l-3 transition-colors hover:bg-(--color-surface-hover) focus-visible:outline-2 focus-visible:outline-(--color-ring) sm:px-6 ${page.key === next?.key ? "border-(--color-primary-accessible) bg-(--color-primary)/5" : "border-transparent border-t border-t-(--color-border)"}`}
              >
                <span className="w-16 text-sm font-semibold tabular-nums">{time(page.starts)}</span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    {names.subjects?.[subject] ?? "Výuka podle rozvrhu"}
                    {names.teaching_groups?.[group] ? ` · ${names.teaching_groups[group]}` : ""}
                  </p>
                  <p className="mt-1 text-sm text-(--color-muted-foreground)">
                    {page.entry?.topic || "Probraná látka zatím není zapsaná"}
                  </p>
                </div>
                <span
                  className={
                    page.key === next?.key && page.entry?.status !== "signed"
                      ? "rounded-lg bg-(--color-primary) px-4 py-3 text-sm font-semibold text-(--color-primary-foreground)"
                      : "text-sm text-(--color-muted-foreground)"
                  }
                >
                  {page.entry?.status === "signed"
                    ? "✓ Hotovo"
                    : page.entry
                      ? "Dokončit zápis →"
                      : "Zapsat hodinu →"}
                </span>
              </Link>
            );
          })}
        </Panel>
      )}
    </section>
  );
}

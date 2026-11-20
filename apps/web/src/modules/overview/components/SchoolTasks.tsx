"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";

import { addDays, today } from "@/core/time/school";
import { Button } from "@/core/ui/actions/Button";
import { ErrorState } from "@/core/ui/feedback/ErrorState";
import { LoadingState } from "@/core/ui/feedback/LoadingState";
import { getMyLessons } from "@/modules/classbook/api";
import { listAllRows, workspaceKey } from "@/modules/shared/records/api";
import { useRecordCatalog } from "@/modules/shared/records/catalog";
import { usePermissions } from "@/modules/shared/records/hooks";

export function SchoolTasks() {
  const can = usePermissions();
  const { getResource } = useRecordCatalog();
  const day = today();
  const lessons = useQuery({
    queryKey: [...workspaceKey, "school-open-lessons", day],
    queryFn: ({ signal }) =>
      getMyLessons(signal, { from: `${day.slice(0, 7)}-01`, to: addDays(day, 1) }),
    enabled: can("classbook.manage") && can("classbook.read"),
  });
  const drafts = useQuery({
    queryKey: [...workspaceKey, "school-draft-versions"],
    queryFn: ({ signal }) => listAllRows(getResource("timetable_versions"), signal),
    enabled: can("timetable.edit"),
  });
  if (!can("classbook.manage") && !can("timetable.edit")) return null;
  return (
    <section className="ui-stack" aria-label="K vyřízení">
      <h2 className="text-lg font-semibold">K vyřízení</h2>
      {can("classbook.manage") && can("classbook.read") && (
        <div>
          {lessons.isPending ? (
            <LoadingState>Kontroluji zápisy tohoto měsíce…</LoadingState>
          ) : lessons.isError ? (
            <ErrorState
              title="Zápisy se nepodařilo načíst"
              error={lessons.error}
              action={
                <Button variant="outline" onClick={() => lessons.refetch()}>
                  Zkusit znovu
                </Button>
              }
            />
          ) : (
            <Link className="workspace-link" href="/app/classbook?view=manage">
              <div>
                <strong>Rozepsané zápisy tohoto měsíce</strong>
                <span>
                  {lessons.data.filter((lesson) => lesson.status === "draft").length} k dokončení do
                  dneška
                </span>
              </div>
              <span aria-hidden="true">→</span>
            </Link>
          )}
        </div>
      )}
      {can("timetable.edit") && (
        <div>
          {drafts.isPending ? (
            <LoadingState>Načítám rozpracované rozvrhy…</LoadingState>
          ) : drafts.isError ? (
            <ErrorState
              title="Rozvrhy se nepodařilo načíst"
              error={drafts.error}
              action={
                <Button variant="outline" onClick={() => drafts.refetch()}>
                  Zkusit znovu
                </Button>
              }
            />
          ) : (
            <Link className="workspace-link" href="/app/timetable?view=manage&step=versions">
              <div>
                <strong>Rozpracované varianty rozvrhu</strong>
                <span>
                  {drafts.data.filter((version) => version.status === "draft").length} pracovních
                  variant
                </span>
              </div>
              <span aria-hidden="true">→</span>
            </Link>
          )}
        </div>
      )}
    </section>
  );
}

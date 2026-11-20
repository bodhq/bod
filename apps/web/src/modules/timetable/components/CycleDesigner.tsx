"use client";
import type { Row } from "@/modules/shared/records/types";

import { useQueries } from "@tanstack/react-query";

import { Button } from "@/core/ui/actions/Button";
import { ErrorState } from "@/core/ui/feedback/ErrorState";
import { LoadingState } from "@/core/ui/feedback/LoadingState";
import { listAllRows, workspaceKey } from "@/modules/shared/records/api";
import { useRecordCatalog } from "@/modules/shared/records/catalog";

import { CycleSequenceEditor } from "./CycleSequenceEditor";

export function CycleDesigner({
  plan,
  onDirtyChange,
}: {
  plan: Row;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const { getResource } = useRecordCatalog();
  const queries = useQueries({
    queries: ["teaching_cycle_weeks", "teaching_cycle_steps"].map((id) => ({
      queryKey: [...workspaceKey, "cycle-designer", id],
      queryFn: ({ signal }: { signal: AbortSignal }) => listAllRows(getResource(id), signal),
    })),
  });
  if (queries.some((query) => query.isPending))
    return <LoadingState>Načítám uspořádání týdnů…</LoadingState>;
  if (queries.some((query) => query.isError))
    return (
      <ErrorState
        error={queries.find((query) => query.isError)?.error}
        action={
          <Button
            variant="outline"
            onClick={() => Promise.all(queries.map((query) => query.refetch()))}
          >
            Zkusit znovu
          </Button>
        }
      />
    );
  const weeks = (queries[0]?.data ?? [])
    .filter((row) => row.teaching_plan_id === plan.id)
    .sort((a, b) => Number(a.position) - Number(b.position));
  const steps = (queries[1]?.data ?? []).filter((row) => row.teaching_plan_id === plan.id);
  return (
    <CycleSequenceEditor
      key={String(plan.id)}
      plan={plan}
      weeks={weeks}
      steps={steps}
      onDirtyChange={onDirtyChange}
    />
  );
}

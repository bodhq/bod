"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { Button } from "@/core/ui/actions/Button";
import { EmptyState } from "@/core/ui/feedback/EmptyState";
import { ErrorState } from "@/core/ui/feedback/ErrorState";
import { LoadingState } from "@/core/ui/feedback/LoadingState";
import { toast } from "@/core/ui/feedback/toast";
import { Textarea } from "@/core/ui/forms/Textarea";
import { Panel } from "@/core/ui/layout/Panel";
import { workspaceKey } from "@/modules/shared/records/api";
import { dateLabel, valueLabels } from "@/modules/shared/records/format";
import { useWorkspaceRefresh } from "@/modules/shared/records/hooks";

import { decideExcuse, getExcuseDetail, getExcuseInbox } from "../api";

function ExcuseReview({ id }: { id: string }) {
  const [note, setNote] = useState("");
  const refresh = useWorkspaceRefresh();
  const query = useQuery({
    queryKey: [...workspaceKey, "excuse-detail", id],
    queryFn: ({ signal }) => getExcuseDetail(id, signal),
  });
  const decide = useMutation({
    mutationFn: ({ recordId, decision }: { recordId: string; decision: "approved" | "rejected" }) =>
      decideExcuse(id, recordId, decision, note),
    onSuccess: async () => {
      setNote("");
      await refresh();
      toast.success("Rozhodnutí bylo uloženo.");
    },
  });
  if (query.isPending) return <LoadingState>Načítám žádost…</LoadingState>;
  if (query.isError)
    return (
      <ErrorState
        error={query.error}
        action={
          <Button variant="outline" onClick={() => query.refetch()}>
            Zkusit znovu
          </Button>
        }
      />
    );
  const request = query.data;
  return (
    <Panel as="article" className="space-y-4">
      <div>
        <h3 className="font-semibold">{request.student_name}</h3>
        <p className="text-sm text-(--color-muted-foreground)">
          {dateLabel(request.created_at, true)} · {valueLabels[request.status]}
        </p>
      </div>
      <p className="whitespace-pre-wrap">{request.reason}</p>
      {request.items.some((item) => item.can_decide) && (
        <Textarea
          label={`Poznámka k rozhodnutí pro ${request.student_name}`}
          value={note}
          maxLength={10000}
          disabled={decide.isPending}
          onChange={(event) => setNote(event.target.value)}
        />
      )}
      {request.items.map((detail) => (
        <div
          key={detail.item.attendance_record_id}
          className="space-y-2 border-t border-(--color-border) pt-3"
        >
          <p className="font-medium">
            {detail.subject_name} · {dateLabel(detail.starts_at, true)}
          </p>
          <p className="text-sm">
            {valueLabels[detail.attendance.status]} · {valueLabels[detail.item.decision]}
          </p>
          {detail.item.decision_note && <p className="text-sm">{detail.item.decision_note}</p>}
          {detail.can_decide && (
            <div className="flex gap-2">
              <Button
                size="sm"
                disabled={decide.isPending}
                onClick={() =>
                  decide.mutate({
                    recordId: detail.item.attendance_record_id,
                    decision: "approved",
                  })
                }
              >
                Omluvit
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={decide.isPending}
                onClick={() =>
                  decide.mutate({
                    recordId: detail.item.attendance_record_id,
                    decision: "rejected",
                  })
                }
              >
                Zamítnout
              </Button>
            </div>
          )}
        </div>
      ))}
      {decide.isError && <ErrorState error={decide.error} />}
    </Panel>
  );
}

export function ExcuseInbox() {
  const query = useQuery({
    queryKey: [...workspaceKey, "excuse-inbox"],
    queryFn: ({ signal }) => getExcuseInbox(signal),
  });
  return (
    <section className="ui-stack">
      <h2 className="text-xl font-semibold">Žádosti k vyřízení</h2>
      {query.isPending ? (
        <LoadingState>Načítám omluvenky…</LoadingState>
      ) : query.isError ? (
        <ErrorState
          error={query.error}
          action={
            <Button variant="outline" onClick={() => query.refetch()}>
              Zkusit znovu
            </Button>
          }
        />
      ) : !query.data.length ? (
        <EmptyState title="Nemáte žádné žádosti k vyřízení" />
      ) : (
        query.data.map((request) => <ExcuseReview key={request.id} id={request.id} />)
      )}
    </section>
  );
}

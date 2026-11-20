"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { useAuthStore, useAuthUser } from "@/core/auth/store";
import { Button } from "@/core/ui/actions/Button";
import { Badge } from "@/core/ui/feedback/Badge";
import { EmptyState } from "@/core/ui/feedback/EmptyState";
import { ErrorState } from "@/core/ui/feedback/ErrorState";
import { LoadingState } from "@/core/ui/feedback/LoadingState";
import { toast } from "@/core/ui/feedback/toast";
import { Select } from "@/core/ui/forms/Select";
import { Dialog } from "@/core/ui/overlays/Dialog";
import { getExcuseDetail, withdrawExcuse } from "@/modules/classbook/api";
import { workspaceKey } from "@/modules/shared/records/api";
import { dateLabel, valueLabels } from "@/modules/shared/records/format";

import { useChildren } from "../hooks/useChildren";
import { useOwnExcuses } from "../hooks/useOwnExcuses";

function ExcuseDetails({ id }: { id: string }) {
  const query = useQuery({
    queryKey: [...workspaceKey, "excuse-detail", id],
    queryFn: ({ signal }) => getExcuseDetail(id, signal),
  });
  if (query.isPending) return <LoadingState>Načítám žádost a rozhodnutí…</LoadingState>;
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
    <div className="ui-stack">
      <p className="font-semibold">{request.student_name}</p>
      <p>
        {dateLabel(request.created_at, true)} · {valueLabels[request.status]}
      </p>
      <p className="whitespace-pre-wrap break-words">{request.reason}</p>
      <ul className="record-list">
        {request.items.map((detail) => (
          <li
            key={detail.item.attendance_record_id}
            className="p-3 border-b border-(--color-border) last:border-0"
          >
            <h3 className="font-semibold">{detail.subject_name}</h3>
            <p>
              {dateLabel(detail.starts_at, true)}–
              {new Date(detail.ends_at).toLocaleTimeString("cs-CZ", {
                timeZone: "Europe/Prague",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
            <p>{valueLabels[detail.attendance.status]}</p>
            <Badge
              tone={
                detail.item.decision === "approved"
                  ? "success"
                  : detail.item.decision === "rejected"
                    ? "danger"
                    : "info"
              }
            >
              {request.status === "withdrawn" && detail.item.decision === "pending"
                ? "Staženo bez rozhodnutí"
                : valueLabels[detail.item.decision]}
            </Badge>
            {detail.item.decided_at && (
              <p className="text-sm text-(--color-muted-foreground)">
                Rozhodnuto {dateLabel(detail.item.decided_at, true)}
              </p>
            )}
            {detail.item.decision_note && (
              <p className="mt-2 whitespace-pre-wrap break-words">
                Poznámka školy: {detail.item.decision_note}
              </p>
            )}
          </li>
        ))}
      </ul>
      {!request.items.length && <p>Žádost neobsahuje žádné dostupné hodiny.</p>}
    </div>
  );
}

export function OwnExcuses() {
  const { confirm, refresh, query } = useOwnExcuses();
  const { parent, children } = useChildren();
  const user = useAuthUser();
  const [student, setStudent] = useState(() =>
    typeof window === "undefined"
      ? ""
      : (new URLSearchParams(window.location.search).get("student") ?? ""),
  );
  const [status, setStatus] = useState("");
  const [detail, setDetail] = useState<string | null>(null);
  const withdraw = useMutation({
    onMutate: () => useAuthStore.getState().sessionVersion,
    mutationFn: withdrawExcuse,
    onSuccess: async (_data, _id, version) => {
      if (version !== useAuthStore.getState().sessionVersion) return;
      await refresh();
      if (version === useAuthStore.getState().sessionVersion) toast.success("Žádost byla stažena.");
    },
  });
  const requests = [...(query.data ?? [])]
    .filter(
      (item) => (!student || item.student_id === student) && (!status || item.status === status),
    )
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  const name = (id: string) =>
    children.data?.find((child) => child.student_id === id)?.name ??
    (user?.id === id ? user.display_name || user.username : "Žádost o omluvení");
  return (
    <section className="ui-stack">
      <h2 className="text-xl font-semibold">Moje omluvenky</h2>
      <p className="text-sm text-(--color-muted-foreground)">
        Novou žádost vytvoříte výběrem absencí v docházce. Zde najdete svá podání a jejich
        rozhodnutí.
      </p>
      <div className="personal-attendance-filters">
        {parent && (
          <Select label="Dítě" value={student} onChange={(event) => setStudent(event.target.value)}>
            <option value="">Všechny děti</option>
            {children.data?.map((child) => (
              <option key={child.student_id} value={child.student_id}>
                {child.name}
              </option>
            ))}
          </Select>
        )}
        <Select
          label="Stav žádosti"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
        >
          <option value="">Všechny stavy</option>
          <option value="open">Čeká na vyřízení</option>
          <option value="closed">Vyřízeno</option>
          <option value="withdrawn">Staženo</option>
        </Select>
      </div>
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
      ) : !requests.length ? (
        <EmptyState title="Zvolenému výběru neodpovídají žádné omluvenky" />
      ) : (
        <ul className="record-list">
          {requests.map((item) => (
            <li className="record-list-item" key={item.id}>
              <div className="record-list-content">
                <h3 className="font-semibold">{name(item.student_id)}</h3>
                <p className="text-sm text-(--color-muted-foreground)">
                  {dateLabel(item.created_at, true)}
                </p>
                <Badge tone={item.status === "open" ? "info" : "neutral"}>
                  {item.status === "closed"
                    ? "Vyřízeno"
                    : item.status === "open"
                      ? "Čeká na vyřízení"
                      : "Staženo"}
                </Badge>
                <p className="mt-2 line-clamp-2 break-words">{item.reason}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => setDetail(item.id)}>
                  Detail a rozhodnutí
                </Button>
                {item.status === "open" && (
                  <Button
                    variant="ghost"
                    disabled={withdraw.isPending}
                    onClick={() =>
                      confirm({
                        title: "Stáhnout žádost?",
                        description:
                          "Žádost se uzavře bez dalšího rozhodování. Dosavadní rozhodnutí zůstanou v historii.",
                        confirmLabel: "Stáhnout žádost",
                        onConfirm: () => withdraw.mutateAsync(item.id),
                      })
                    }
                  >
                    Stáhnout žádost
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      <Dialog open={!!detail} onClose={() => setDetail(null)} title="Omluvenka a rozhodnutí">
        {detail && <ExcuseDetails id={detail} />}
      </Dialog>
    </section>
  );
}

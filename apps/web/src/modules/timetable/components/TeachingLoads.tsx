"use client";
import type { Row } from "@/modules/shared/records/types";

import { useMutation } from "@tanstack/react-query";
import { useState } from "react";

import { Button } from "@/core/ui/actions/Button";
import { EmptyState } from "@/core/ui/feedback/EmptyState";
import { ErrorState } from "@/core/ui/feedback/ErrorState";
import { LoadingState } from "@/core/ui/feedback/LoadingState";
import { Input } from "@/core/ui/forms/Input";
import { Select } from "@/core/ui/forms/Select";
import { Panel, PanelHeader } from "@/core/ui/layout/Panel";
import { Distribution, Quantity } from "@/core/ui/visuals/Quantity";
import { request, resourcePath } from "@/modules/shared/records/api";
import { useRecordCatalog } from "@/modules/shared/records/catalog";
import { RecordDialog } from "@/modules/shared/records/components/RecordDialog";
import { useWorkspaceRefresh } from "@/modules/shared/records/hooks";

import { useTeachingLoads } from "../hooks/useTeachingLoads";

export function TeachingLoads({ planId, readOnly }: { planId: string; readOnly: boolean }) {
  const {
    data,
    getResource,
    refresh,
    search,
    setSearch,
    teacher,
    setTeacher,
    editor,
    setEditor,
    assignments,
    weeks,
    label,
    teacherName,
    rows,
    missing,
    fields,
  } = useTeachingLoads({ planId });
  if (data.loading) return <LoadingState>Načítám úvazky…</LoadingState>;
  if (data.error)
    return (
      <ErrorState
        error={data.error}
        action={
          <Button variant="outline" onClick={data.retry}>
            Zkusit znovu
          </Button>
        }
      />
    );
  return (
    <section className="ui-stack">
      <PanelHeader
        title="Úvazky výuky"
        eyebrow="Podklady podle ŠVP"
        description="Každá karta propojuje předmět se skupinou a vyučujícím. Body ukazují počet hodin v jednotlivých podobách týdne."
        actions={!readOnly && <Button onClick={() => setEditor({})}>Přidat úvazek</Button>}
      />
      <div className="flex flex-wrap items-end gap-3">
        <Input
          label="Najít úvazek"
          fieldWidth="standard"
          placeholder="Předmět, skupina nebo učitel…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <Select
          label="Vyučující"
          fieldWidth="standard"
          value={teacher}
          onChange={(event) => setTeacher(event.target.value)}
        >
          <option value="">Všichni vyučující</option>
          {[...new Set(assignments.map((row) => String(row.teacher_id)))].map((id) => (
            <option key={id} value={id}>
              {teacherName(id)}
            </option>
          ))}
        </Select>
        <p className="pb-2 text-sm text-(--color-muted-foreground)">
          {assignments.length} přiřazení · {missing} bez úplné dotace
        </p>
      </div>
      {!weeks.length && (
        <p className="text-sm text-(--color-warning)">
          Nejprve vytvořte typy týdnů v části Cyklus a společné bloky. Potom nastavte počty hodin.
        </p>
      )}
      {assignments.length > 0 && (
        <Panel as="div" className="ui-stack">
          <h3 className="font-semibold">Rozložení výuky mezi vyučující</h3>
          <p className="text-xs text-(--color-muted-foreground)">
            Součet uložených hodin pro všechny typy týdnů; nejde o průměrný týdenní úvazek.
          </p>
          <Distribution
            label="Celkové hodiny vyučujících v cyklu"
            items={[...new Set(assignments.map((row) => String(row.teacher_id)))].map((id) => ({
              id,
              label: teacherName(id),
              value: data.loads
                .filter(
                  (load) =>
                    assignments.some(
                      (row) => row.teacher_id === id && row.id === load.teaching_assignment_id,
                    ) && weeks.some((week) => week.id === load.cycle_week_id),
                )
                .reduce((sum, load) => sum + Number(load.periods), 0),
            }))}
          />
        </Panel>
      )}
      <section className="visual-records" aria-label="Úvazky podle ŠVP">
        {rows.map((row) => (
          <Panel as="article" key={String(row.id)} className="ui-stack">
            <PanelHeader
              title={label(row.subject_id, "subjects", "Předmět")}
              level="h3"
              eyebrow={label(row.group_id, "teaching_groups", "Skupina")}
              actions={
                !readOnly && (
                  <Button variant="outline" size="sm" onClick={() => setEditor({ row })}>
                    Upravit
                  </Button>
                )
              }
            />
            <div className="visual-relations">
              <div className="visual-relation-node">
                <span className="text-xs text-(--color-muted-foreground)">Vyučující</span>
                <strong>{teacherName(row.teacher_id)}</strong>
              </div>
              <div className="visual-relation-node">
                <span className="text-xs text-(--color-muted-foreground)">
                  Typ učebny pro všechny hodiny
                </span>
                <strong>
                  {row.required_room_type_code
                    ? label(row.required_room_type_code, "room_types", "Typ")
                    : "Bez omezení typu"}
                </strong>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {weeks.map((week) => {
                const load = data.loads.find(
                  (load) =>
                    load.teaching_assignment_id === row.id && load.cycle_week_id === week.id,
                );
                return (
                  <div
                    className="rounded-(--radius) bg-(--color-surface-200) p-3"
                    key={String(week.id)}
                  >
                    <p className="mb-3 text-sm font-semibold">Týden {String(week.code)}</p>
                    {load ? (
                      <Quantity value={Number(load.periods)} label="hodin týdně" />
                    ) : (
                      <p className="mb-3 text-xs text-(--color-warning)">Dotace chybí</p>
                    )}
                    <div className="mt-3">
                      <LoadValue
                        key={`${row.id}:${week.id}:${load?.periods}`}
                        assignment={row}
                        label={`${label(row.subject_id, "subjects", "Předmět")} · ${label(row.group_id, "teaching_groups", "Skupina")}`}
                        week={week}
                        current={load}
                        readOnly={readOnly}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </Panel>
        ))}
      </section>
      {!rows.length && (
        <EmptyState title="Zatím žádné odpovídající úvazky">
          Přidejte přiřazení skupiny, předmětu a vyučujícího.
        </EmptyState>
      )}
      {readOnly && (
        <p className="text-sm text-(--color-muted-foreground)">
          Tento plán je uzamčený. Pro změny vytvořte kopii rozvrhu.
        </p>
      )}
      {editor && (
        <RecordDialog
          title={editor.row ? "Upravit úvazek" : "Přidat úvazek"}
          description="Požadavek na učebnu platí pro všechny hodiny tohoto úvazku. Teorii a cvičení zatím nelze nastavit odděleně. Bez zvoleného typu není typ učebny omezený."
          editing={!!editor.row}
          initial={editor.row ?? {}}
          fields={fields}
          onClose={() => setEditor(null)}
          onSave={async (body) => {
            const resource = getResource("teaching_assignments");
            if (editor.row && resource.parsePatch)
              await request("PATCH", resourcePath(resource, editor.row), {
                body: resource.parsePatch(body),
              });
            else
              await request("POST", resource.path, {
                body: resource.parseCreate({ ...body, teaching_plan_id: planId }),
              });
            await refresh();
            setEditor(null);
          }}
        />
      )}
    </section>
  );
}
function LoadValue({
  assignment,
  label,
  week,
  current,
  readOnly,
}: {
  assignment: Row;
  label: string;
  week: Row;
  current?: Row;
  readOnly: boolean;
}) {
  const [value, setValue] = useState(current ? String(current.periods) : "");
  const { getResource } = useRecordCatalog();
  const refresh = useWorkspaceRefresh();
  const save = useMutation({
    mutationFn: async () => {
      const periods = Number(value);
      if (value === "" || !Number.isInteger(periods) || periods < 0)
        throw new Error("Zadejte nezáporný celý počet hodin.");
      const resource = getResource("teaching_assignment_weeks");
      if (current && resource.parsePatch)
        await request("PATCH", resourcePath(resource, current), {
          body: resource.parsePatch({ periods }),
        });
      else
        await request("POST", resource.path, {
          body: resource.parseCreate({
            teaching_assignment_id: assignment.id,
            cycle_week_id: week.id,
            periods,
          }),
        });
      await refresh();
    },
  });
  return (
    <form
      className="space-y-2"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate();
      }}
    >
      <Input
        type="number"
        min={0}
        step={1}
        aria-label={`Hodiny ${label} v týdnu ${week.code}`}
        placeholder="—"
        value={value}
        disabled={readOnly || save.isPending}
        onChange={(event) => setValue(event.target.value)}
      />
      {!readOnly && value !== (current ? String(current.periods) : "") && (
        <Button type="submit" variant="outline" size="sm" isLoading={save.isPending}>
          Uložit
        </Button>
      )}
      {save.isError && (
        <p role="alert" className="text-xs text-(--color-destructive)">
          {save.error.message}
        </p>
      )}
    </form>
  );
}

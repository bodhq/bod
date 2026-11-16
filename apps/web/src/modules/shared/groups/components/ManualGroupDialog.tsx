"use client";

import type { usePlanningGroups } from "../hooks/usePlanningGroups";

import { Button } from "@/core/ui/actions/Button";
import { ErrorState } from "@/core/ui/feedback/ErrorState";
import { FormActions } from "@/core/ui/forms/FormActions";
import { Input } from "@/core/ui/forms/Input";
import { Select } from "@/core/ui/forms/Select";
import { StepProgress } from "@/core/ui/navigation/StepProgress";
import { Dialog } from "@/core/ui/overlays/Dialog";
import { addDays, rowLabel } from "@/modules/shared/records/format";

import { groupMembers } from "../membership";
import { StudentSelectionTable } from "./StudentSelectionTable";

type Model = Pick<
  ReturnType<typeof usePlanningGroups>,
  | "adding"
  | "creationMethod"
  | "save"
  | "setAdding"
  | "review"
  | "name"
  | "created"
  | "setName"
  | "from"
  | "setFrom"
  | "to"
  | "setTo"
  | "accounts"
  | "classes"
  | "data"
  | "context"
  | "chosen"
  | "setChosen"
  | "sourceGroup"
  | "setSourceGroup"
  | "groups"
  | "students"
  | "savedIds"
  | "setReview"
>;
export function ManualGroupDialog({ model }: { model: Model }) {
  const {
    adding,
    creationMethod,
    save,
    setAdding,
    review,
    name,
    created,
    setName,
    from,
    setFrom,
    to,
    setTo,
    accounts,
    classes,
    data,
    context,
    chosen,
    setChosen,
    sourceGroup,
    setSourceGroup,
    groups,
    students,
    savedIds,
    setReview,
  } = model;
  const reviewContext = { ...context, from, to };
  const overlaps = groups.flatMap((group) => {
    const shared = [
      ...new Set(groupMembers(group.id, reviewContext).map((member) => String(member.student_id))),
    ].filter((id) => chosen.includes(id));
    return shared.length ? [{ group, count: shared.length }] : [];
  });
  return (
    <Dialog
      open={adding && creationMethod === "manual"}
      onClose={() => {
        if (!save.isPending) setAdding(false);
      }}
      title={review ? "Zkontrolujte novou skupinu" : "Sestavit skupinu z žáků"}
      description="Výběr zůstává zachovaný při změně filtru. Můžete spojit žáky z více tříd i existujících skupin."
      className="max-w-6xl"
    >
      <div className="mt-5 space-y-4">
        <StepProgress steps={["Vybrat žáky", "Zkontrolovat skupinu"]} current={review ? 1 : 0} />
        <div className="grid gap-4 sm:grid-cols-3">
          <Input
            label="Název skupiny"
            placeholder="Např. TV dívky · 3. ročník"
            value={name}
            disabled={!!created || save.isPending}
            onChange={(event) => setName(event.target.value)}
          />
          <Input
            label="Členství od"
            type="date"
            value={from}
            disabled={!!created || save.isPending}
            onChange={(event) => setFrom(event.target.value)}
          />
          <Input
            label="Poslední den členství"
            type="date"
            value={to ? addDays(to, -1) : ""}
            disabled={!!created || save.isPending}
            onChange={(event) => setTo(event.target.value ? addDays(event.target.value, 1) : "")}
          />
        </div>
        {!review ? (
          <>
            <StudentSelectionTable
              accounts={accounts.data ?? []}
              classes={classes}
              specializations={data.rows("specializations")}
              context={{ ...context, groups, from, to }}
              selected={chosen}
              onChange={setChosen}
            />
            <details className="ui-panel p-3">
              <summary className="cursor-pointer text-sm font-medium">
                Přidat členy existující skupiny
              </summary>
              <div className="mt-3 flex flex-wrap items-end gap-2">
                <Select
                  label="Zdrojová skupina"
                  fieldWidth="standard"
                  value={sourceGroup}
                  onChange={(event) => setSourceGroup(event.target.value)}
                >
                  <option value="">Vyberte skupinu…</option>
                  {groups.map((row) => (
                    <option key={String(row.id)} value={String(row.id)}>
                      {rowLabel(row)}
                    </option>
                  ))}
                </Select>
                <Button
                  variant="outline"
                  disabled={!sourceGroup}
                  onClick={() =>
                    setChosen((previous) => [
                      ...new Set([
                        ...previous,
                        ...groupMembers(sourceGroup, { ...context, from, to })
                          .map((row) => String(row.student_id))
                          .filter((id) => students.some((student) => student.id === id)),
                      ]),
                    ])
                  }
                >
                  Přidat členy do výběru
                </Button>
              </div>
            </details>
          </>
        ) : (
          <div className="space-y-3">
            <p className="text-sm">
              <strong>{chosen.length} žáků</strong> bude ve skupině {name || "bez názvu"}. Členství
              v původních skupinách zůstává.
            </p>
            <div className="grid max-h-64 gap-2 overflow-y-auto sm:grid-cols-2">
              {chosen.map((id) => (
                <p key={id} className="text-sm">
                  {rowLabel(students.find((row) => row.id === id) ?? { id })}
                  {savedIds.includes(id) ? " · uloženo" : ""}
                </p>
              ))}
            </div>
            <section className="ui-panel p-4" aria-label="Překryvy nové skupiny">
              <h3 className="text-sm font-semibold">
                Se kterými skupinami nemůže probíhat současně?
              </h3>
              <p className="mt-1 text-xs text-(--color-muted-foreground)">
                Podle společných žáků ve zvoleném období. Překryv je v pořádku, pokud hodiny nejsou
                ve stejnou dobu.
              </p>
              {context.membershipAvailable ? (
                overlaps.length ? (
                  <ul className="mt-3 divide-y divide-(--color-border)">
                    {overlaps.map(({ group, count }) => (
                      <li
                        key={String(group.id)}
                        className="flex justify-between gap-3 py-2 text-sm"
                      >
                        <span>{rowLabel(group)}</span>
                        <span className="shrink-0">{count} společných žáků</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-sm">
                    Bez společných žáků v dostupných skupinách. Učitele a učebny ověříte při
                    sestavování rozvrhu.
                  </p>
                )
              ) : (
                <p className="mt-3 text-sm text-(--color-warning)">
                  Překryvy nelze ověřit. Složení ostatních skupin není dostupné.
                </p>
              )}
            </section>
          </div>
        )}
        {save.isError && (
          <ErrorState
            title={
              created
                ? `Skupina už existuje, uloženo ${savedIds.length} z ${chosen.length} členství. Zkuste uložit zbývající.`
                : "Skupinu se nepodařilo uložit"
            }
            error={save.error}
          />
        )}
        <FormActions
          onCancel={() => setAdding(false)}
          onBack={review ? () => setReview(false) : undefined}
          backLabel="Zpět k výběru"
          backDisabled={!!created}
          pending={save.isPending}
          disabled={!name.trim() || !chosen.length || !from || !to || from >= to}
          onSubmit={() => (review ? save.mutate() : setReview(true))}
          submitLabel={
            review
              ? created
                ? "Uložit zbývající členy"
                : "Vytvořit skupinu"
              : `Zkontrolovat výběr (${chosen.length})`
          }
        />
      </div>
    </Dialog>
  );
}

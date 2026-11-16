"use client";
import { Button } from "@/core/ui/actions/Button";
import { EmptyState } from "@/core/ui/feedback/EmptyState";
import { ErrorState } from "@/core/ui/feedback/ErrorState";
import { LoadingState } from "@/core/ui/feedback/LoadingState";
import { Input } from "@/core/ui/forms/Input";
import { Select } from "@/core/ui/forms/Select";
import { PanelHeader } from "@/core/ui/layout/Panel";
import { Dialog } from "@/core/ui/overlays/Dialog";
import { rowLabel } from "@/modules/shared/records/format";

import "../groups.css";
import { usePlanningGroups } from "../hooks/usePlanningGroups";
import { groupMembers } from "../membership";
import { AutomaticGroupBuilder } from "./AutomaticGroupBuilder";
import { GroupRelations } from "./GroupRelations";
import { ManualGroupDialog } from "./ManualGroupDialog";

export function PlanningGroups() {
  const studio = usePlanningGroups();
  const {
    data,
    scope,
    can,
    setSelectedId,
    search,
    setSearch,
    adding,
    setAdding,
    creationMethod,
    setCreationMethod,
    accounts,
    groups,
    classes,
    selected,
    context,
    open,
  } = studio;
  if (!can("school.manage"))
    return (
      <EmptyState title="Skupiny připravuje správce školy">
        Pro výběr žáků a kontrolu překryvů potřebujete přístup k evidenci školy.
      </EmptyState>
    );
  if (data.loading) return <LoadingState>Načítám složení skupin…</LoadingState>;
  if (data.errors.length)
    return (
      <ErrorState
        title="Složení skupin není kompletní"
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
        title="Výukové skupiny"
        description="Spojte žáky napříč třídami. Než začnete rozmisťovat výuku, ověřte, které skupiny mohou běžet současně."
        actions={
          <Button disabled={!scope} onClick={open}>
            + Sestavit skupinu
          </Button>
        }
      />
      {!can("users.manage") && (
        <p className="text-sm text-(--color-muted-foreground)">
          Jmenný výběr žáků je dostupný s oprávněním ke správě účtů.
        </p>
      )}
      {accounts.isError && (
        <ErrorState
          title="Jmenný seznam se nepodařilo načíst"
          error={accounts.error}
          action={
            <Button variant="outline" onClick={() => accounts.refetch()}>
              Zkusit znovu
            </Button>
          }
        />
      )}
      {groups.length > 0 && (
        <div className="ui-panel flex flex-wrap items-end gap-3 p-4">
          <Input
            label="Najít skupinu"
            fieldWidth="standard"
            placeholder="Třída, jazyk, tělocvik…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <Select
            label="Skupina pro kontrolu"
            fieldWidth="standard"
            value={String(selected?.id ?? "")}
            onChange={(event) => setSelectedId(event.target.value)}
          >
            {groups
              .filter(
                (row) =>
                  row.id === selected?.id ||
                  rowLabel(row).toLocaleLowerCase("cs").includes(search.toLocaleLowerCase("cs")),
              )
              .map((row) => (
                <option key={String(row.id)} value={String(row.id)}>
                  {rowLabel(row)} ·{" "}
                  {new Set(groupMembers(row.id, context).map((item) => item.student_id)).size} žáků
                </option>
              ))}
          </Select>
        </div>
      )}
      {selected ? (
        <GroupRelations model={studio} />
      ) : (
        <EmptyState title="Začněte sestavením první skupiny">
          Například tělocvik napříč třídami nebo společná jazyková skupina.
        </EmptyState>
      )}
      <Dialog
        open={adding && creationMethod === "choose"}
        onClose={() => setAdding(false)}
        title="Jak chcete vytvořit skupiny?"
        description="Automaticky rozdělte třídu, nebo sestavte společnou skupinu z konkrétních žáků."
        className="max-w-3xl"
      >
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Button
            variant="outline"
            className="h-auto min-h-36 justify-start p-5 text-left"
            contentClassName="flex-col items-start gap-3"
            onClick={() => setCreationMethod("automatic")}
          >
            <span className="text-lg font-semibold">Rozdělit automaticky</span>
            <span className="text-sm font-normal text-(--color-muted-foreground)">
              Abecedně do stejně velkých skupin nebo podle pravidel zaměření. S náhledem počtů před
              vytvořením.
            </span>
          </Button>
          <Button
            variant="outline"
            className="h-auto min-h-36 justify-start p-5 text-left"
            contentClassName="flex-col items-start gap-3"
            disabled={!can("users.manage") || !accounts.isSuccess}
            onClick={() => setCreationMethod("manual")}
          >
            <span className="text-lg font-semibold">Vybrat žáky ručně</span>
            <span className="text-sm font-normal text-(--color-muted-foreground)">
              Vyfiltrujte žáky napříč školou a spojte je do jedné skupiny. Výběr zůstává zachovaný
              při změně filtrů.
            </span>
          </Button>
        </div>
      </Dialog>
      <AutomaticGroupBuilder
        key={scope?.interval.start}
        open={adding && creationMethod === "automatic"}
        classes={classes}
        specializations={data.rows("specializations")}
        studyFields={data.rows("study_fields")}
        context={context}
        onClose={() => setAdding(false)}
        onBack={() => setCreationMethod("choose")}
        onCreated={(id) => {
          setSelectedId(id);
          setAdding(false);
        }}
      />
      <ManualGroupDialog model={studio} />
    </section>
  );
}

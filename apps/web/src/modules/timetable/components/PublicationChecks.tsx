"use client";

import type { useTimetableStudio } from "../hooks/useTimetableStudio";

import { Button } from "@/core/ui/actions/Button";
import { ErrorState } from "@/core/ui/feedback/ErrorState";
import { Panel } from "@/core/ui/layout/Panel";

type Model = Pick<
  ReturnType<typeof useTimetableStudio>,
  | "setShowChecks"
  | "remaining"
  | "excess"
  | "unset"
  | "conflicts"
  | "setInspectedId"
  | "label"
  | "assignments"
  | "planning"
  | "week"
  | "slots"
  | "publication"
>;
export function PublicationChecks({
  model,
  onLocate,
  dismissible = true,
}: {
  model: Model;
  onLocate?: () => void;
  dismissible?: boolean;
}) {
  const { setShowChecks, remaining, unset, conflicts, setInspectedId, label, assignments } = model;
  return (
    <Panel id="publication-checks" tabIndex={-1} padded={false} as="div" className="space-y-3 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-semibold">Kontrola před publikací</h3>
        {dismissible && (
          <Button variant="outline" size="sm" onClick={() => setShowChecks(false)}>
            Zavřít kontrolu
          </Button>
        )}
      </div>
      <p className="text-sm text-(--color-muted-foreground)">
        Nálezy platí pro vybraný týden cyklu. Publikaci všech týdnů, kalendář, nedostupnost a
        společné bloky ověří server.
      </p>
      <div className="space-y-2 border-b border-(--color-border) pb-4" role="status">
        <h4 className="font-medium">Kontrola celého rozvrhu na serveru</h4>
        {model.publication.isPending ? (
          <p>Ověřuji všechny týdny a podklady…</p>
        ) : model.publication.isError ? (
          <ErrorState error={model.publication.error} />
        ) : model.publication.data?.can_publish ? (
          <p className="text-sm text-(--color-success)">
            Rozvrh lze publikovat. Server při publikaci provede kontrolu znovu.
          </p>
        ) : (
          model.publication.data?.issues.map((issue) => (
            <p key={issue.code} className="text-sm text-(--color-warning)">
              {issue.message}
            </p>
          ))
        )}
        <Button
          variant="outline"
          size="sm"
          disabled={model.publication.isFetching}
          onClick={() => model.publication.refetch()}
        >
          Zopakovat kontrolu
        </Button>
      </div>
      {!assignments.length && (
        <p className="text-sm text-(--color-warning)">
          Plán zatím nemá žádné úvazky. Nejdřív připravte výuku v podkladech.
        </p>
      )}
      {remaining > 0 && (
        <p className="text-sm text-(--color-warning)">
          Ještě zbývá umístit {remaining} hodin podle zadaných úvazků.
        </p>
      )}
      {model.excess > 0 && (
        <p className="text-sm text-(--color-warning)">
          V návrhu je {model.excess} hodin nad zadané úvazky.
        </p>
      )}
      {unset > 0 && (
        <p className="text-sm text-(--color-warning)">
          {unset} přiřazení nemá nastavený počet hodin.
        </p>
      )}
      {conflicts.map(({ row, issues }) => (
        <button
          type="button"
          className="block w-full rounded-lg bg-(--color-destructive)/5 p-3 text-left text-sm"
          key={String(row.id)}
          onClick={() => {
            setInspectedId(String(row.id));
            onLocate?.();
          }}
        >
          <strong>
            {label(assignments.find((item) => item.id === row.teaching_assignment_id) ?? {})}
          </strong>
          <span className="mt-1 block text-(--color-destructive)">{issues.join(" · ")}</span>
        </button>
      ))}
      {!model.week || !model.slots.length ? (
        <p className="text-sm text-(--color-warning)">
          Kontrola není připravená. Doplňte týdny cyklu a zvonění.
        </p>
      ) : !model.planning.membershipAvailable ||
        model.planning.loading ||
        model.planning.errors.length ? (
        <p className="text-sm text-(--color-warning)">
          Kontrola je neúplná. Překryvy skupin a vhodnost učeben nelze plně ověřit z dostupných
          podkladů.
        </p>
      ) : (
        !!assignments.length &&
        !conflicts.length && (
          <p className="text-sm text-(--color-success)">
            Bez kolizí v dostupných podkladech tohoto týdne.
          </p>
        )
      )}
    </Panel>
  );
}

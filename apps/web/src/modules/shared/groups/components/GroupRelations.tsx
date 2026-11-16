"use client";

import type { usePlanningGroups } from "../hooks/usePlanningGroups";

import { Panel } from "@/core/ui/layout/Panel";
import { rowLabel } from "@/modules/shared/records/format";

import { groupMembers, sharedStudents } from "../membership";

type Model = Pick<
  ReturnType<typeof usePlanningGroups>,
  "selected" | "memberIds" | "groups" | "context" | "accounts"
>;
export function GroupRelations({ model }: { model: Model }) {
  const { selected, memberIds, groups, context, accounts } = model;
  if (!selected) return null;
  return (
    <Panel padded={false} as="div" className="space-y-6 p-5 sm:p-6">
      <div className="flex flex-wrap justify-between gap-3">
        <div>
          <p className="ui-eyebrow">Složení a vazby</p>
          <h3 className="mt-1 text-xl font-semibold">{rowLabel(selected)}</h3>
        </div>
        <span className="text-sm text-(--color-muted-foreground)">
          {memberIds.length} žáků v období školního roku
        </span>
      </div>
      <div>
        <h4 className="font-semibold">Mohou probíhat současně?</h4>
        <p className="mt-1 text-xs text-(--color-muted-foreground)">
          Porovnáváme skutečná členství včetně jejich platnosti. Učitele a učebny ověříte na plátně.
        </p>
        <div className="mt-3 divide-y divide-(--color-border)">
          {groups
            .filter((row) => row.id !== selected.id)
            .map((row) => {
              const shared = sharedStudents(selected.id, row.id, context);
              const otherCount = new Set(
                groupMembers(row.id, context).map((member) => member.student_id),
              ).size;
              return (
                <div
                  key={String(row.id)}
                  className="grid gap-3 py-3 text-sm sm:grid-cols-[minmax(0,1fr)_minmax(140px,1fr)]"
                >
                  <div>
                    <span className="font-medium">{rowLabel(row)}</span>
                    <div
                      className="visual-overlap mt-2"
                      role="img"
                      aria-label={`${shared.length} společných žáků z ${memberIds.length} ve vybrané skupině a ${otherCount} ve srovnávané skupině`}
                    >
                      <div>
                        <span
                          style={{
                            width: `${memberIds.length ? (shared.length / memberIds.length) * 100 : 0}%`,
                          }}
                        />
                      </div>
                      <div>
                        <span
                          style={{
                            width: `${otherCount ? (shared.length / otherCount) * 100 : 0}%`,
                          }}
                        />
                      </div>
                    </div>
                    <p className="mt-1 text-xs text-(--color-muted-foreground)">
                      {memberIds.length} / {otherCount} žáků · zvýrazněná část je společná
                    </p>
                  </div>
                  <span
                    className={
                      shared.length
                        ? "font-medium text-(--color-destructive)"
                        : "text-(--color-success)"
                    }
                  >
                    {shared.length
                      ? `${shared.length} společných žáků · souběh koliduje`
                      : "Bez společných žáků"}
                  </span>
                </div>
              );
            })}
          {groups.length < 2 && (
            <p className="py-4 text-sm text-(--color-muted-foreground)">
              Pro porovnání přidejte další skupinu.
            </p>
          )}
        </div>
      </div>
      <div>
        <h4 className="font-semibold">Žáci ve skupině</h4>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {memberIds.map((id) => (
            <p key={id} className="text-sm">
              {accounts.data?.find((row) => row.id === id)
                ? rowLabel(accounts.data.find((row) => row.id === id) ?? { id })
                : `Žák ${id.slice(0, 8)}`}
            </p>
          ))}
          {!memberIds.length && (
            <p className="text-sm text-(--color-muted-foreground)">
              Ve sledovaném období nemá skupina žádné členy.
            </p>
          )}
        </div>
      </div>
    </Panel>
  );
}

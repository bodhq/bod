"use client";

import type { useCycleSequence } from "../hooks/useCycleSequence";

import { Select } from "@/core/ui/forms/Select";
import { Panel } from "@/core/ui/layout/Panel";
import { RelatedRecords } from "@/modules/shared/records/components/RelatedRecords";

type Model = Pick<
  ReturnType<typeof useCycleSequence>,
  "blockWeek" | "weeks" | "setBlockWeek" | "locked"
>;
export function CommonTeachingBlocks({ model }: { model: Model }) {
  const { blockWeek, weeks, setBlockWeek, locked } = model;
  return (
    <Panel as="details">
      <summary className="cursor-pointer font-semibold">Společné bloky výuky</summary>
      <p className="my-3 text-sm text-(--color-muted-foreground)">
        Hodiny, které mají probíhat současně, propojte do bloku. Blok vždy patří ke konkrétní podobě
        týdne.
      </p>
      <Select
        label="Bloky pro týden"
        fieldWidth="standard"
        value={blockWeek || String(weeks[0]?.id)}
        onChange={(event) => setBlockWeek(event.target.value)}
      >
        {weeks.map((week) => (
          <option key={String(week.id)} value={String(week.id)}>
            {String(week.code)}
          </option>
        ))}
      </Select>
      <div className="mt-4">
        <RelatedRecords
          key={blockWeek || String(weeks[0]?.id)}
          resourceId="teaching_blocks"
          bound={{ cycle_week_id: blockWeek || weeks[0]?.id }}
          readOnly={locked}
          createLabel="Nový blok"
          sections={[
            {
              id: "teaching_block_members",
              parentField: "block_id",
              parentFields: { cycle_week_id: "cycle_week_id" },
              createLabel: "Přiřadit výuku do bloku",
            },
          ]}
        />
      </div>
    </Panel>
  );
}

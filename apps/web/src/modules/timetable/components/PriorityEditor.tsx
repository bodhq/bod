"use client";
import type { Row } from "@/modules/shared/records/types";
import type { options } from "../preference-options";

import { Button } from "@/core/ui/actions/Button";
import { ErrorState } from "@/core/ui/feedback/ErrorState";
import { Select } from "@/core/ui/forms/Select";
import { Panel } from "@/core/ui/layout/Panel";

import { usePriorityEditor } from "../hooks/usePriorityEditor";

export function PriorityEditor({
  option,
  current,
  version,
}: {
  option: (typeof options)[number];
  current?: Row;
  version: Row;
}) {
  const { weight, setWeight, save } = usePriorityEditor({ option, current, version });
  return (
    <Panel padded={false} as="article" className="flex flex-col gap-4 p-5">
      <div>
        <h3 className="text-lg font-semibold">{option.title}</h3>
        <p className="mt-2 text-sm text-(--color-muted-foreground)">{option.description}</p>
      </div>
      <div
        className="visual-priority-meter"
        role="img"
        aria-label={`Důležitost ${weight} z ${Math.max(10, Number(weight))}`}
      >
        <div
          style={{
            width: `${(Math.max(0, Number(weight)) / Math.max(10, Number(weight))) * 100}%`,
          }}
        />
      </div>
      <div className="mt-auto">
        <Select
          label="Důležitost"
          value={weight}
          disabled={version.status !== "draft" || save.isPending}
          onChange={(event) => setWeight(event.target.value)}
        >
          {!["0", "1", "5", "10"].includes(weight) && (
            <option value={weight}>Vlastní váha {weight}</option>
          )}
          <option value="0">Bez preference</option>
          <option value="1">Běžná</option>
          <option value="5">Důležitá</option>
          <option value="10">Velmi důležitá</option>
        </Select>
      </div>
      {version.status === "draft" && weight !== String(current?.weight ?? 0) && (
        <Button isLoading={save.isPending} onClick={() => save.mutate()}>
          Uložit prioritu
        </Button>
      )}
      {save.isError && <ErrorState error={save.error} />}
    </Panel>
  );
}

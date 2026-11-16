"use client";
import type { ReactNode } from "react";

import { useInfiniteQuery } from "@tanstack/react-query";
import { useState } from "react";

import { Button } from "@/core/ui/actions/Button";
import { LoadingState } from "@/core/ui/feedback/LoadingState";
import { Select } from "@/core/ui/forms/Select";
import { listRows, PAGE_SIZE, workspaceKey } from "@/modules/shared/records/api";
import { useRecordCatalog } from "@/modules/shared/records/catalog";
import { addDays, dateLabel, monday, today } from "@/modules/shared/records/format";
import { usePermissions } from "@/modules/shared/records/hooks";
import { type RecordScope, RecordScopeProvider } from "@/modules/shared/records/scope";

export function SchoolYearScope({
  children,
  compact = false,
  beforeChange,
}: {
  children: ReactNode | ((selector: ReactNode) => ReactNode);
  compact?: boolean;
  beforeChange?: (action: () => void) => void;
}) {
  const can = usePermissions();
  const { getResource } = useRecordCatalog();
  const [chosen, setChosen] = useState("");
  const years = useInfiniteQuery({
    queryKey: [...workspaceKey, "academic-years"],
    initialPageParam: 0,
    queryFn: ({ pageParam, signal }) => listRows(getResource("school_years"), pageParam, signal),
    getNextPageParam: (last, pages) =>
      last.length === PAGE_SIZE ? pages.length * PAGE_SIZE : undefined,
    enabled: can("school.manage"),
  });
  const available = (years.data?.pages.flat() ?? [])
    .filter(
      (year) =>
        typeof year.id === "string" &&
        typeof year.starts_on === "string" &&
        typeof year.ends_on === "string",
    )
    .sort((a, b) => String(b.starts_on).localeCompare(String(a.starts_on)));
  const day = today();
  const year =
    available.find((item) => item.id === chosen) ??
    available.find((item) => String(item.starts_on) <= day && day < String(item.ends_on)) ??
    available[0];
  const scope: RecordScope | null = year
    ? {
        defaults: {
          school_year_id: year.id,
          valid_from: year.starts_on,
          valid_to: year.ends_on,
          effective_from: year.starts_on,
          cycle_anchor_monday: monday(String(year.starts_on)),
        },
        interval: {
          start: String(year.starts_on),
          end: String(year.ends_on),
          label: String(year.name),
        },
        referenceFilters: Object.fromEntries(
          ["classes", "teaching_groups", "teaching_plans"].map((id) => [
            id,
            { school_year_id: year.id },
          ]),
        ),
      }
    : null;
  const selector = (
    <>
      {can("school.manage") && year && (
        <div
          className={
            compact ? "flex items-center gap-2" : "ui-panel flex flex-wrap items-end gap-4 p-4"
          }
        >
          <Select
            fieldWidth={compact ? "short" : "standard"}
            label={compact ? undefined : "Výchozí školní rok"}
            aria-label="Výchozí školní rok"
            value={String(year.id)}
            onChange={(event) => {
              const value = event.target.value;
              const action = () => setChosen(value);
              if (beforeChange) beforeChange(action);
              else action();
            }}
          >
            {available.map((item) => (
              <option key={String(item.id)} value={String(item.id)}>
                {String(item.name)}
              </option>
            ))}
          </Select>
          {!compact && (
            <div className="pb-2 text-sm text-(--color-muted-foreground)">
              <p>
                {dateLabel(String(year.starts_on))} – {dateLabel(addDays(String(year.ends_on), -1))}
              </p>
              <p className="mt-1">Výchozí rok pro nové třídy a výuku.</p>
            </div>
          )}
          {years.hasNextPage && (
            <Button
              variant="outline"
              size="sm"
              disabled={years.isFetchingNextPage}
              onClick={() => years.fetchNextPage()}
            >
              Načíst další roky
            </Button>
          )}
        </div>
      )}
      {years.isError && (
        <p role="alert" className="text-sm text-(--color-destructive)">
          Školní roky se nepodařilo načíst.{" "}
          <Button variant="outline" size="sm" onClick={() => years.refetch()}>
            Zkusit znovu
          </Button>
        </p>
      )}
    </>
  );
  const content =
    typeof children === "function" ? (
      children(selector)
    ) : (
      <div className="ui-stack">
        {selector}
        {children}
      </div>
    );
  return (
    <RecordScopeProvider value={scope}>
      {can("school.manage") && years.isLoading ? (
        <LoadingState>Načítám školní roky…</LoadingState>
      ) : (
        content
      )}
    </RecordScopeProvider>
  );
}

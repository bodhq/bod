"use client";
import Link from "next/link";

import { ErrorState } from "@/core/ui/feedback/ErrorState";
import { LoadingState } from "@/core/ui/feedback/LoadingState";
import { Panel } from "@/core/ui/layout/Panel";
import { Distribution } from "@/core/ui/visuals/Quantity";
import { rowLabel } from "@/modules/shared/records/format";

import { useSchoolLandscape } from "../hooks/useSchoolLandscape";

export function SchoolLandscape() {
  const { allowed, queries, rows } = useSchoolLandscape();
  if (!allowed.length) return null;
  if (queries.some((query) => query.isPending))
    return <LoadingState>Sestavuji mapu školy…</LoadingState>;
  if (queries.some((query) => query.isError))
    return (
      <ErrorState
        title="Mapu školy se nepodařilo načíst"
        error={queries.find((query) => query.isError)?.error}
      />
    );
  return (
    <Panel className="ui-stack" aria-label="Mapa školy">
      <header>
        <p className="ui-eyebrow">Jak do sebe škola zapadá</p>
        <h2 className="mt-1 text-xl font-semibold">Lidé, prostory a výuka</h2>
      </header>
      <div className="visual-landscape">
        {allowed.includes("classes") && (
          <div className="ui-stack">
            <Link href="/app/school?evidence=classes" className="visual-landscape-node">
              <span className="text-3xl font-semibold">{rows("classes").length}</span>
              <strong>Třídy</strong>
            </Link>
            <Distribution
              label="Třídy podle školního roku"
              items={rows("school_years").map((year) => ({
                id: String(year.id),
                label: rowLabel(year),
                value: rows("classes").filter((row) => row.school_year_id === year.id).length,
              }))}
            />
            <Link
              href="/app/school?evidence=teaching_groups"
              className="text-sm font-semibold text-(--color-primary-accessible)"
            >
              {rows("teaching_groups").length} výukových skupin →
            </Link>
          </div>
        )}
        {allowed.includes("rooms") && (
          <div className="ui-stack">
            <Link href="/app/rooms" className="visual-landscape-node">
              <span className="text-3xl font-semibold">{rows("rooms").length}</span>
              <strong>Učebny</strong>
            </Link>
            <Distribution
              label="Učebny podle typu"
              items={rows("room_types").map((type) => ({
                id: String(type.code),
                label: rowLabel(type),
                value: rows("rooms").filter((row) => row.room_type_code === type.code).length,
              }))}
            />
            <p className="text-sm text-(--color-muted-foreground)">
              {rows("rooms")
                .filter((row) => row.is_active !== false)
                .reduce((sum, row) => sum + Number(row.capacity ?? 0), 0)}{" "}
              míst v aktivních učebnách
            </p>
          </div>
        )}
        {allowed.includes("teaching_plans") && (
          <div className="ui-stack">
            <Link href="/app/timetable?evidence=teaching_plans" className="visual-landscape-node">
              <span className="text-3xl font-semibold">{rows("teaching_plans").length}</span>
              <strong>Plány výuky</strong>
            </Link>
            <div className="ui-stack">
              {rows("teaching_plans")
                .slice(0, 4)
                .map((plan) => (
                  <div key={String(plan.id)} className="visual-relations">
                    <div className="visual-relation-node">
                      <span className="text-xs text-(--color-muted-foreground)">
                        {plan.frozen_at ? "Uzamčený plán" : "Rozpracovaný plán"}
                      </span>
                      <strong>{rowLabel(plan)}</strong>
                    </div>
                    <div className="visual-relation-node">
                      <span className="text-xs text-(--color-muted-foreground)">Školní rok</span>
                      <strong>
                        {(rows("school_years").find((year) => year.id === plan.school_year_id)
                          ?.name as string) ?? "Neurčen"}
                      </strong>
                    </div>
                  </div>
                ))}
            </div>
            {!rows("teaching_plans").length && (
              <p className="text-sm text-(--color-muted-foreground)">
                Založte plán a propojte skupiny, úvazky a učebny do rozvrhu.
              </p>
            )}
          </div>
        )}
      </div>
      <p className="text-xs text-(--color-muted-foreground)">
        Celá evidence školy napříč školními roky. Otevřete oblast pro podrobnosti a úpravy.
      </p>
    </Panel>
  );
}

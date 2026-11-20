"use client";

import type { ReactNode } from "react";
import type { Row } from "../types";

import { List } from "lucide-react";
import { useState } from "react";

import { Button } from "@/core/ui/actions/Button";
import { PanelHeader } from "@/core/ui/layout/Panel";
import { ViewSwitcher } from "@/core/ui/navigation/ViewSwitcher";

import { patchRow } from "../api";
import { useRecordCatalog } from "../catalog";
import { rowLabel } from "../format";
import { usePermissions, useWorkspaceRefresh } from "../hooks";
import { RecordDialog } from "./RecordDialog";
import { ResourceManager } from "./ResourceManager";

export interface RelatedSection {
  id: string;
  parentField: string;
  parentFields?: Record<string, string>;
  title?: string;
  createLabel?: string;
  children?: RelatedSection[];
}

// A relationship has one entry point: open its parent, then work with its children.
export function RelatedRecords({
  resourceId,
  sections,
  bound = {},
  readOnly = false,
  createLabel,
  renderSection,
}: {
  resourceId: string;
  sections: RelatedSection[];
  bound?: Row;
  readOnly?: boolean;
  createLabel?: string;
  renderSection?: (section: RelatedSection, parent: Row, readOnly: boolean) => ReactNode;
}) {
  const { getResource } = useRecordCatalog();
  const resource = getResource(resourceId);
  const can = usePermissions();
  const refresh = useWorkspaceRefresh();
  const [selected, setSelected] = useState<Row | null>(null);
  const [tab, setTab] = useState("");
  const [editing, setEditing] = useState(false);
  const available = sections.filter((section) => can(getResource(section.id).permission));
  const section = available.find((item) => item.id === tab) ?? available[0];
  const locked =
    readOnly ||
    !!selected?.frozen_at ||
    (resourceId === "timetable_versions" && selected?.status !== "draft");
  if (!selected || !section)
    return (
      <ResourceManager
        resource={resource}
        bound={bound}
        readOnly={readOnly}
        onOpen={
          available.length
            ? (row) => {
                setSelected(row);
                setTab("");
              }
            : undefined
        }
        createLabel={createLabel}
      />
    );
  const childBound = {
    [section.parentField]: selected.id ?? selected.code,
    ...Object.fromEntries(
      Object.entries(section.parentFields ?? {}).map(([childKey, parentKey]) => [
        childKey,
        selected[parentKey],
      ]),
    ),
  };
  const child = getResource(section.id);
  return (
    <section className="ui-stack">
      <Button variant="outline" size="sm" onClick={() => setSelected(null)}>
        ← {resource.title}
      </Button>
      <PanelHeader
        title={rowLabel(selected)}
        eyebrow={resource.title}
        actions={
          !locked &&
          resource.parsePatch && (
            <Button variant="outline" onClick={() => setEditing(true)}>
              Upravit údaje
            </Button>
          )
        }
      />
      {locked && (
        <p className="text-sm text-(--color-muted-foreground)">
          Tato verze je uzamčená. Údaje jsou pouze ke čtení.
        </p>
      )}
      {available.length > 1 && (
        <ViewSwitcher
          label={`Obsah: ${resource.title}`}
          value={section.id}
          onChange={setTab}
          items={available.map((item) => ({
            id: item.id,
            title: item.title ?? getResource(item.id).title,
            icon: getResource(item.id).icon ?? List,
          }))}
        />
      )}
      {renderSection ? (
        renderSection(section, selected, locked)
      ) : section.children ? (
        <RelatedRecords
          key={section.id}
          resourceId={section.id}
          sections={section.children}
          bound={childBound}
          readOnly={locked}
          createLabel={section.createLabel}
        />
      ) : (
        <ResourceManager
          key={section.id}
          resource={child}
          bound={childBound}
          readOnly={locked}
          createLabel={section.createLabel}
        />
      )}
      {editing && (
        <RecordDialog
          title={`Upravit: ${resource.title}`}
          editing
          initial={selected}
          fields={resource.fields.filter(
            (field) =>
              resource.patchFields.includes(field.name) &&
              !Object.hasOwn(bound, field.name) &&
              !["status", "origin"].includes(field.name),
          )}
          onClose={() => setEditing(false)}
          onSave={async (body) => {
            if (!resource.parsePatch) return;
            const saved = await patchRow(resource, selected, body);
            setSelected(saved);
            await refresh();
            setEditing(false);
          }}
        />
      )}
    </section>
  );
}

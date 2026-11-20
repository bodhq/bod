"use client";
import type { ResourceDefinition, Row, WorkflowDefinition } from "@/modules/shared/records/types";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { useAuthUser } from "@/core/auth/store";
import { useConfirm } from "@/core/ui/overlays/ConfirmProvider";
import { listAllRows, listRows, workspaceKey } from "@/modules/shared/records/api";
import { useRecordCatalog } from "@/modules/shared/records/catalog";
import {
  usePermissions,
  useReferenceNames,
  useWorkspaceRefresh,
} from "@/modules/shared/records/hooks";

export function useResourceManager({
  resource,
  bound = {},
}: {
  resource: ResourceDefinition;
  bound?: Row;
}) {
  const { workflows } = useRecordCatalog();
  const can = usePermissions();
  const user = useAuthUser();
  const confirm = useConfirm();
  const refresh = useWorkspaceRefresh();
  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState("");
  const [editor, setEditor] = useState<{ row?: Row } | null>(null);
  const [detail, setDetail] = useState<Row | null>(null);
  const [action, setAction] = useState<{ workflow: WorkflowDefinition; row: Row } | null>(null);
  const names = useReferenceNames(
    resource.readFields.flatMap((field) => (field.reference ? [field.reference] : [])),
  );
  const query = useQuery({
    queryKey: [
      ...workspaceKey,
      "records",
      resource.id,
      search.trim() ? 0 : offset,
      bound,
      !!search.trim(),
    ],
    queryFn: async ({ signal }) =>
      Object.keys(bound).length || search.trim()
        ? (await listAllRows(resource, signal)).filter((row) =>
            Object.entries(bound).every(([key, value]) => row[key] === value),
          )
        : listRows(resource, offset, signal),
    enabled: can(resource.permission),
  });
  return {
    workflows,
    can,
    user,
    confirm,
    refresh,
    offset,
    setOffset,
    search,
    setSearch,
    editor,
    setEditor,
    detail,
    setDetail,
    action,
    setAction,
    names,
    query,
  };
}

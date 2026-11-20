"use client";

import type { IssuedAccount } from "@bod/api-client/types.gen";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { useState } from "react";

import { getAccountDirectory } from "@/core/accounts/api";
import { useConfirm } from "@/core/ui/overlays/ConfirmProvider";
import { listAllRows, request, workspaceKey } from "@/modules/shared/records/api";
import { useRecordCatalog } from "@/modules/shared/records/catalog";
import { useWorkspaceRefresh } from "@/modules/shared/records/hooks";

export function useStudentFamilies() {
  const queryClient = useQueryClient();
  const { getResource } = useRecordCatalog();
  const resource = getResource("parent_students");
  const refresh = useWorkspaceRefresh();
  const confirm = useConfirm();
  const [creatingFor, setCreatingFor] = useState<string | null>(null);
  const [issued, setIssued] = useState<IssuedAccount | null>(null);
  const [search, setSearch] = useState("");
  const params = useSearchParams();
  const [studentId, setStudentId] = useState(params.get("zak") ?? "");
  const [parentId, setParentId] = useState("");
  const accounts = useQuery({
    queryKey: [...workspaceKey, "family-directory"],
    queryFn: ({ signal }) => getAccountDirectory(signal),
  });
  const links = useQuery({
    queryKey: [...workspaceKey, "family-links"],
    queryFn: ({ signal }) => listAllRows(resource, signal),
  });
  const assign = useMutation({
    mutationFn: async ({ student, parent }: { student: string; parent: string }) => {
      await request("POST", resource.path, {
        body: resource.parseCreate({ student_id: student, parent_id: parent }),
      });
      await refresh();
    },
    onSuccess: () => setParentId(""),
  });
  return {
    queryClient,
    resource,
    refresh,
    confirm,
    creatingFor,
    setCreatingFor,
    issued,
    setIssued,
    search,
    setSearch,
    studentId,
    setStudentId,
    parentId,
    setParentId,
    accounts,
    links,
    assign,
  };
}

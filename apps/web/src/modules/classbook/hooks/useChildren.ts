"use client";

import { useQuery } from "@tanstack/react-query";

import { schoolRole } from "@/core/auth/roles";
import { useAuthUser } from "@/core/auth/store";
import { workspaceKey } from "@/modules/shared/records/api";

import { getChildren } from "../api";

export function useChildren() {
  const user = useAuthUser();
  const parent = schoolRole(user) === "parent";
  const children = useQuery({
    queryKey: [...workspaceKey, "my-children"],
    queryFn: ({ signal }) => getChildren(signal),
    enabled: parent && !!user?.permissions?.includes("classbook.read"),
  });
  return { parent, children };
}
